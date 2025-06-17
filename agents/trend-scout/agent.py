#!/usr/bin/env python3
"""
Trend Scout Agent - Ingests RSS feeds, Twitter/X, and Google Trends
Generates 5-line briefs for content ideation
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import aiohttp
import feedparser
from pytrends.request import TrendReq
import redis
from opentelemetry import trace
from opentelemetry.exporter.jaeger import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel, Field, validator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure OpenTelemetry
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

jaeger_exporter = JaegerExporter(
    agent_host_name=os.getenv('JAEGER_AGENT_HOST', 'localhost'),
    agent_port=int(os.getenv('JAEGER_AGENT_PORT', '6831')),
)
span_processor = BatchSpanProcessor(jaeger_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Redis connection
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'redis-cluster.grayghostai'),
    port=int(os.getenv('REDIS_PORT', '6379')),
    password=os.getenv('REDIS_PASSWORD'),
    decode_responses=True
)

class TrendSource(BaseModel):
    """Configuration for a trend data source"""
    name: str
    type: str = Field(..., pattern="^(rss|twitter|trends)$")
    url: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    enabled: bool = True

class TrendBrief(BaseModel):
    """Output format for trend briefs"""
    id: str
    title: str
    summary: List[str] = Field(..., max_items=5, min_items=5)
    source: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    keywords: List[str]
    timestamp: datetime
    raw_data: Optional[Dict[str, Any]] = None

    @validator('summary')
    def validate_summary_lines(cls, v):
        for line in v:
            if len(line) > 100:
                raise ValueError(f"Summary line too long: {len(line)} chars (max 100)")
        return v

class TrendScout:
    """Main agent class for trend scouting"""
    
    def __init__(self):
        self.sources = self._load_sources()
        self.api_quota = int(os.getenv('API_QUOTA', '1000'))
        self.ttl_hours = int(os.getenv('TTL_HOURS', '24'))
        self.api_calls_made = 0
        
    def _load_sources(self) -> List[TrendSource]:
        """Load trend sources from configuration"""
        default_sources = [
            TrendSource(
                name="Krebs on Security",
                type="rss",
                url="https://krebsonsecurity.com/feed/",
                keywords=["security", "breach", "cyber"]
            ),
            TrendSource(
                name="Dark Reading",
                type="rss",
                url="https://www.darkreading.com/rss.xml",
                keywords=["threat", "vulnerability", "attack"]
            ),
            TrendSource(
                name="Google Trends - Tech",
                type="trends",
                keywords=["AI", "cybersecurity", "cloud", "blockchain"]
            )
        ]
        return default_sources
    
    @tracer.start_as_current_span("fetch_rss_feed")
    async def _fetch_rss_feed(self, source: TrendSource) -> List[Dict[str, Any]]:
        """Fetch and parse RSS feed"""
        if self.api_calls_made >= self.api_quota:
            logger.warning(f"API quota exceeded: {self.api_calls_made}/{self.api_quota}")
            return []
            
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(source.url, timeout=30) as response:
                    content = await response.text()
                    feed = feedparser.parse(content)
                    self.api_calls_made += 1
                    
                    items = []
                    for entry in feed.entries[:10]:  # Limit to 10 most recent
                        items.append({
                            'title': entry.get('title', ''),
                            'link': entry.get('link', ''),
                            'summary': entry.get('summary', ''),
                            'published': entry.get('published_parsed', None),
                            'source': source.name
                        })
                    return items
                    
            except Exception as e:
                logger.error(f"Error fetching RSS from {source.name}: {e}")
                return []
    
    @tracer.start_as_current_span("fetch_google_trends")
    def _fetch_google_trends(self, source: TrendSource) -> List[Dict[str, Any]]:
        """Fetch Google Trends data"""
        if self.api_calls_made >= self.api_quota:
            logger.warning(f"API quota exceeded: {self.api_calls_made}/{self.api_quota}")
            return []
            
        try:
            pytrends = TrendReq(hl='en-US', tz=360)
            pytrends.build_payload(source.keywords, timeframe='now 1-d')
            interest_df = pytrends.interest_over_time()
            self.api_calls_made += 1
            
            if interest_df.empty:
                return []
                
            # Convert to list of trend items
            items = []
            for keyword in source.keywords:
                if keyword in interest_df.columns:
                    avg_interest = interest_df[keyword].mean()
                    items.append({
                        'title': f"Trending: {keyword}",
                        'interest_score': float(avg_interest),
                        'keyword': keyword,
                        'source': 'Google Trends'
                    })
            
            return sorted(items, key=lambda x: x['interest_score'], reverse=True)[:5]
            
        except Exception as e:
            logger.error(f"Error fetching Google Trends: {e}")
            return []
    
    @tracer.start_as_current_span("generate_brief")
    def _generate_brief(self, raw_items: List[Dict[str, Any]], source: str) -> Optional[TrendBrief]:
        """Generate a 5-line brief from raw trend data"""
        if not raw_items:
            return None
            
        # Sort by relevance/interest
        sorted_items = sorted(
            raw_items,
            key=lambda x: x.get('interest_score', 0) + len(x.get('title', '')),
            reverse=True
        )
        
        # Extract top item for main brief
        top_item = sorted_items[0]
        
        # Generate 5-line summary
        summary_lines = [
            f"TREND: {top_item.get('title', 'Unknown trend detected')}",
            f"SOURCE: {source} | RELEVANCE: High",
            f"KEY INSIGHT: {self._extract_insight(top_item)}",
            f"OPPORTUNITY: {self._suggest_opportunity(top_item)}",
            f"ACTION: Monitor for next 24-48 hours"
        ]
        
        # Calculate relevance score
        relevance_score = min(1.0, len(sorted_items) / 10.0)
        
        brief = TrendBrief(
            id=f"trend_{datetime.utcnow().timestamp()}",
            title=top_item.get('title', ''),
            summary=summary_lines,
            source=source,
            relevance_score=relevance_score,
            keywords=self._extract_keywords(sorted_items),
            timestamp=datetime.utcnow(),
            raw_data={'items': sorted_items[:3]}  # Include top 3 for context
        )
        
        return brief
    
    def _extract_insight(self, item: Dict[str, Any]) -> str:
        """Extract key insight from trend item"""
        if 'summary' in item:
            # Truncate summary to fit line limit
            return item['summary'][:80] + "..."
        elif 'interest_score' in item:
            return f"Search interest at {item['interest_score']:.0f}% of peak"
        else:
            return "Emerging topic gaining traction"
    
    def _suggest_opportunity(self, item: Dict[str, Any]) -> str:
        """Suggest content opportunity based on trend"""
        keywords = item.get('keyword', '').lower()
        
        if any(term in keywords for term in ['ai', 'automation', 'ml']):
            return "Create tutorial or case study content"
        elif any(term in keywords for term in ['security', 'breach', 'threat']):
            return "Develop security best practices guide"
        elif any(term in keywords for term in ['cloud', 'devops', 'kubernetes']):
            return "Share implementation insights"
        else:
            return "Analyze impact on target audience"
    
    def _extract_keywords(self, items: List[Dict[str, Any]]) -> List[str]:
        """Extract unique keywords from all items"""
        keywords = set()
        for item in items:
            if 'keyword' in item:
                keywords.add(item['keyword'])
            if 'title' in item:
                # Simple keyword extraction from title
                words = item['title'].lower().split()
                keywords.update(w for w in words if len(w) > 4)
        
        return list(keywords)[:10]
    
    @tracer.start_as_current_span("process_request")
    async def process(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing method for agent requests"""
        logger.info(f"Processing trend scout request: {request}")
        
        # Extract sources from request
        requested_sources = request.get('sources', ['all'])
        
        # Collect trend data
        all_items = []
        
        for source in self.sources:
            if 'all' not in requested_sources and source.name not in requested_sources:
                continue
                
            if source.type == 'rss':
                items = await self._fetch_rss_feed(source)
                all_items.extend(items)
            elif source.type == 'trends':
                items = self._fetch_google_trends(source)
                all_items.extend(items)
        
        # Generate brief
        brief = self._generate_brief(all_items, ', '.join(requested_sources))
        
        if not brief:
            return {
                'status': 'no_trends',
                'message': 'No significant trends detected',
                'timestamp': datetime.utcnow().isoformat()
            }
        
        # Cache result in Redis
        cache_key = f"trend_brief:{brief.id}"
        redis_client.setex(
            cache_key,
            timedelta(hours=self.ttl_hours),
            json.dumps(brief.dict(), default=str)
        )
        
        return {
            'status': 'success',
            'brief': brief.dict(),
            'api_calls_remaining': self.api_quota - self.api_calls_made,
            'timestamp': datetime.utcnow().isoformat()
        }

async def main():
    """Main entry point for the agent"""
    logger.info("Trend Scout Agent starting...")
    
    # Create agent instance
    scout = TrendScout()
    
    # Example request (in production, this would come from agent-runner)
    request = {
        'sources': ['Krebs on Security', 'Google Trends - Tech'],
        'keywords': ['cybersecurity', 'AI'],
        'execution_id': 'test-123'
    }
    
    # Process request
    result = await scout.process(request)
    
    # Output result
    print(json.dumps(result, indent=2))
    
    # Cleanup
    await asyncio.sleep(1)  # Allow spans to flush

if __name__ == "__main__":
    asyncio.run(main())