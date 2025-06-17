#!/usr/bin/env python3
"""
Trend Scout Agent V2 - Enterprise Edition
Following Anthropic best practices and n8n AI integration patterns
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import aiohttp
import feedparser
from pytrends.request import TrendReq

# Import enterprise base class
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base.enterprise_agent import (
    EnterpriseAgent, 
    AgentRequest, 
    AgentResponse, 
    AgentContext,
    StructuredPromptBuilder
)

logger = logging.getLogger(__name__)

class TrendScoutAgent(EnterpriseAgent):
    """
    Enterprise Trend Scout Agent
    Discovers and analyzes trending topics for content creation
    """
    
    def __init__(self):
        super().__init__(
            agent_id="trend-scout",
            agent_name="Trend Scout",
            version="2.0.0"
        )
        
        # Agent-specific configuration
        self.rss_sources = self._load_rss_sources()
        self.api_quota = int(os.getenv('TREND_API_QUOTA', '1000'))
        self.trend_cache_ttl = int(os.getenv('TREND_CACHE_TTL', '3600'))
        
        # Initialize trend tools
        self.tools = self._initialize_tools()
        
    def get_supported_actions(self) -> List[str]:
        """Return supported actions"""
        return [
            "discover_trends",
            "analyze_trend",
            "generate_brief",
            "compare_trends",
            "predict_virality"
        ]
    
    def _initialize_tools(self) -> List[Dict[str, Any]]:
        """Initialize tools for Claude to use"""
        return [
            {
                "name": "fetch_rss_feeds",
                "description": "Fetch latest posts from security and tech RSS feeds",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "sources": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of RSS feed names to fetch"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum items per feed",
                            "default": 10
                        }
                    },
                    "required": ["sources"]
                }
            },
            {
                "name": "get_google_trends",
                "description": "Get trending topics from Google Trends",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Keywords to check trends for"
                        },
                        "timeframe": {
                            "type": "string",
                            "description": "Time range (e.g., 'now 1-d', 'now 7-d')",
                            "default": "now 1-d"
                        }
                    },
                    "required": ["keywords"]
                }
            },
            {
                "name": "analyze_sentiment",
                "description": "Analyze sentiment and engagement potential of content",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "Text to analyze"
                        },
                        "context": {
                            "type": "object",
                            "description": "Additional context for analysis"
                        }
                    },
                    "required": ["text"]
                }
            }
        ]
    
    async def process_action(self, action: str, data: Dict[str, Any], 
                           context: AgentContext) -> Dict[str, Any]:
        """Process specific actions"""
        
        if action == "discover_trends":
            return await self._discover_trends(data, context)
        elif action == "analyze_trend":
            return await self._analyze_trend(data, context)
        elif action == "generate_brief":
            return await self._generate_brief(data, context)
        elif action == "compare_trends":
            return await self._compare_trends(data, context)
        elif action == "predict_virality":
            return await self._predict_virality(data, context)
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _discover_trends(self, data: Dict[str, Any], 
                             context: AgentContext) -> Dict[str, Any]:
        """Discover current trends from multiple sources"""
        logger.info(f"Discovering trends with context: {context.request_id}")
        
        # Check cache first
        cache_key = f"trends:discover:{datetime.now().strftime('%Y%m%d%H')}"
        cached_result = self.redis_client.get(cache_key)
        if cached_result:
            logger.info("Returning cached trends")
            return json.loads(cached_result)
        
        # Use Claude with tools to discover trends
        system_prompt = """You are an expert trend analyst specializing in technology and cybersecurity content.
Your task is to identify trending topics that would make engaging social media content.
Focus on topics that are:
1. Currently trending or emerging
2. Relevant to the target audience
3. Have high engagement potential
4. Can be explained simply"""
        
        user_prompt = StructuredPromptBuilder.build_tool_use_prompt(
            task="Discover the top trending topics in technology and cybersecurity from RSS feeds and Google Trends",
            available_tools=["fetch_rss_feeds", "get_google_trends", "analyze_sentiment"]
        )
        
        # Execute tool-based discovery
        response = await self.call_anthropic(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tools=self.tools,
            temperature=0.7
        )
        
        # Process the response
        trends = await self._process_trend_discovery(response, data)
        
        # Cache the result
        self.redis_client.setex(
            cache_key,
            self.trend_cache_ttl,
            json.dumps(trends)
        )
        
        return trends
    
    async def _analyze_trend(self, data: Dict[str, Any], 
                           context: AgentContext) -> Dict[str, Any]:
        """Deep analysis of a specific trend"""
        trend_data = data.get('trend', {})
        
        analysis_prompt = f"""<trend_analysis>
<trend>
Title: {trend_data.get('title', 'Unknown')}
Description: {trend_data.get('description', '')}
Source: {trend_data.get('source', '')}
Metrics: {json.dumps(trend_data.get('metrics', {}))}
</trend>

<analysis_requirements>
1. Assess the trend's relevance to our target audience (IT professionals, security teams)
2. Evaluate engagement potential (1-10 scale)
3. Identify key talking points
4. Suggest content angles (educational, news, how-to, etc.)
5. Estimate longevity (fleeting, short-term, long-term)
6. Identify potential risks or sensitivities
</analysis_requirements>

<output_format>
Return a JSON object with:
- relevance_score (0-100)
- engagement_potential (1-10)
- key_points (array of strings)
- content_angles (array of objects with type and description)
- longevity (fleeting/short-term/long-term)
- risks (array of strings)
- recommendation (pursue/monitor/skip)
</output_format>
</trend_analysis>"""
        
        response = await self.call_anthropic(
            system_prompt="You are a content strategist analyzing trends for social media content creation.",
            user_prompt=analysis_prompt,
            temperature=0.5,
            max_tokens=2000
        )
        
        return response
    
    async def _generate_brief(self, data: Dict[str, Any], 
                            context: AgentContext) -> Dict[str, Any]:
        """Generate a content brief from trend data"""
        trends = data.get('trends', [])
        target_audience = data.get('target_audience', 'general tech audience')
        
        brief_prompt = f"""<brief_generation>
<trends>
{json.dumps(trends[:5], indent=2)}
</trends>

<target_audience>{target_audience}</target_audience>

<brief_requirements>
Generate a 5-line executive brief that:
1. LINE 1: Captures the main trend in an attention-grabbing way
2. LINE 2: Explains why this matters RIGHT NOW
3. LINE 3: Provides a key insight or surprising fact
4. LINE 4: Suggests how the audience can benefit or take action
5. LINE 5: Includes a specific timeframe or urgency factor

Additional requirements:
- Use active voice and strong verbs
- Include specific numbers or data points where available
- Avoid jargon unless necessary for the audience
- Make it shareable and quotable
</brief_requirements>

<output_format>
{
  "brief_lines": ["line1", "line2", "line3", "line4", "line5"],
  "headline": "attention-grabbing headline under 10 words",
  "hashtags": ["relevant", "hashtags", "maximum", "5"],
  "content_type": "educational|news|how-to|analysis",
  "urgency_level": "high|medium|low",
  "key_metrics": {"metric_name": value}
}
</output_format>
</brief_generation>"""
        
        response = await self.call_anthropic(
            system_prompt="You are an expert content brief writer specializing in viral tech content.",
            user_prompt=brief_prompt,
            temperature=0.8,
            max_tokens=1500
        )
        
        # Post-process the brief
        brief = response
        brief['generated_at'] = datetime.now(timezone.utc).isoformat()
        brief['trend_sources'] = [t.get('source', 'unknown') for t in trends[:3]]
        
        # Store in Notion-ready format
        brief['notion_properties'] = {
            'Title': brief.get('headline', ''),
            'Brief': '\n'.join(brief.get('brief_lines', [])),
            'Content_Type': brief.get('content_type', 'news'),
            'Urgency': brief.get('urgency_level', 'medium'),
            'Status': 'Idea'
        }
        
        return brief
    
    async def _compare_trends(self, data: Dict[str, Any], 
                            context: AgentContext) -> Dict[str, Any]:
        """Compare multiple trends to identify the best opportunity"""
        trends = data.get('trends', [])
        
        comparison_prompt = f"""<trend_comparison>
<trends_to_compare>
{json.dumps(trends, indent=2)}
</trends_to_compare>

<comparison_criteria>
1. Audience relevance (how well it matches our IT/security audience)
2. Engagement potential (likelihood of likes, shares, comments)
3. Competition level (how saturated is this topic)
4. Content complexity (how easy to explain)
5. Visual potential (can we create compelling visuals)
6. Timeliness (how time-sensitive is this)
</comparison_criteria>

<output_requirements>
For each trend, provide:
- Overall score (0-100)
- Scores for each criterion (0-10)
- Key advantages
- Main challenges
- Recommended content format

Then provide:
- Top recommendation with reasoning
- Alternative option if the top choice doesn't work out
</output_requirements>
</trend_comparison>"""
        
        response = await self.call_anthropic(
            system_prompt="You are a data-driven content strategist comparing trends for maximum impact.",
            user_prompt=comparison_prompt,
            temperature=0.6,
            max_tokens=3000
        )
        
        return response
    
    async def _predict_virality(self, data: Dict[str, Any], 
                              context: AgentContext) -> Dict[str, Any]:
        """Predict viral potential of content idea"""
        content_idea = data.get('content_idea', {})
        platform = data.get('platform', 'general')
        
        virality_prompt = f"""<virality_prediction>
<content_idea>
{json.dumps(content_idea, indent=2)}
</content_idea>

<platform>{platform}</platform>

<prediction_factors>
1. Emotional triggers (curiosity, surprise, fear, joy)
2. Practical value (how useful is this information)
3. Social currency (does sharing this make people look good)
4. Timing relevance (riding current events or trends)
5. Simplicity (how easy to understand and share)
6. Visual appeal potential
7. Controversy level (balanced - not too safe, not too risky)
</prediction_factors>

<historical_patterns>
Consider that in tech/security content:
- "How to protect yourself from X" posts get 3x average engagement
- Breaking news about breaches spike within 2 hours
- Educational content with clear steps performs consistently
- Myth-busting content generates debate and shares
</historical_patterns>

<output_format>
{
  "virality_score": 0-100,
  "confidence_level": "high|medium|low",
  "key_strengths": ["strength1", "strength2"],
  "improvement_suggestions": ["suggestion1", "suggestion2"],
  "optimal_posting_time": "time recommendation",
  "expected_metrics": {
    "views_range": [min, max],
    "engagement_rate": "X%",
    "share_likelihood": "high|medium|low"
  },
  "risk_factors": ["risk1", "risk2"]
}
</output_format>
</virality_prediction>"""
        
        response = await self.call_anthropic(
            system_prompt="You are a viral content prediction expert with deep knowledge of social media algorithms.",
            user_prompt=virality_prompt,
            temperature=0.7,
            max_tokens=2000
        )
        
        return response
    
    async def _process_trend_discovery(self, claude_response: Dict[str, Any], 
                                     original_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process Claude's tool use response into structured trend data"""
        # This would process the actual tool calls and responses
        # For now, return a structured response
        
        return {
            "trends": [
                {
                    "id": f"trend_{datetime.now().timestamp()}",
                    "title": "Example Trend",
                    "source": "Multiple Sources",
                    "relevance_score": 85,
                    "metrics": {
                        "search_volume": 10000,
                        "growth_rate": 0.25
                    }
                }
            ],
            "discovery_metadata": {
                "sources_checked": len(self.rss_sources),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cache_status": "miss"
            }
        }
    
    def _load_rss_sources(self) -> List[Dict[str, str]]:
        """Load RSS feed sources"""
        return [
            {
                "name": "Krebs on Security",
                "url": "https://krebsonsecurity.com/feed/",
                "category": "security"
            },
            {
                "name": "Dark Reading",
                "url": "https://www.darkreading.com/rss.xml",
                "category": "security"
            },
            {
                "name": "The Hacker News",
                "url": "https://thehackernews.com/feeds/posts/default",
                "category": "security"
            },
            {
                "name": "TechCrunch",
                "url": "https://techcrunch.com/feed/",
                "category": "tech"
            }
        ]
    
    # Tool implementation methods
    async def _tool_fetch_rss_feeds(self, sources: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        """Implementation of fetch_rss_feeds tool"""
        results = []
        
        for source_name in sources:
            source = next((s for s in self.rss_sources if s['name'] == source_name), None)
            if not source:
                continue
                
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(source['url'], timeout=30) as response:
                        content = await response.text()
                        feed = feedparser.parse(content)
                        
                        for entry in feed.entries[:limit]:
                            results.append({
                                'title': entry.get('title', ''),
                                'link': entry.get('link', ''),
                                'summary': entry.get('summary', ''),
                                'published': entry.get('published', ''),
                                'source': source_name,
                                'category': source['category']
                            })
            except Exception as e:
                logger.error(f"Error fetching {source_name}: {e}")
                
        return results
    
    async def _tool_get_google_trends(self, keywords: List[str], 
                                    timeframe: str = 'now 1-d') -> Dict[str, Any]:
        """Implementation of get_google_trends tool"""
        try:
            pytrends = TrendReq(hl='en-US', tz=360)
            pytrends.build_payload(keywords, timeframe=timeframe)
            
            interest_df = pytrends.interest_over_time()
            related_queries = pytrends.related_queries()
            
            return {
                'interest_over_time': interest_df.to_dict() if not interest_df.empty else {},
                'related_queries': related_queries
            }
        except Exception as e:
            logger.error(f"Error fetching Google Trends: {e}")
            return {}

# n8n Integration Helper
class TrendScoutN8nConnector:
    """Helper class for n8n workflow integration"""
    
    @staticmethod
    def create_webhook_node_config() -> Dict[str, Any]:
        """Create n8n webhook node configuration"""
        return {
            "parameters": {
                "httpMethod": "POST",
                "path": "trend-scout-webhook",
                "responseMode": "onReceived",
                "responseData": "allEntries",
                "options": {}
            },
            "name": "Trend Scout Webhook",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 1,
            "position": [250, 300]
        }
    
    @staticmethod
    def create_agent_node_config() -> Dict[str, Any]:
        """Create n8n HTTP request node for agent"""
        return {
            "parameters": {
                "url": "http://trend-scout-agent:8080/process",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {
                            "name": "action",
                            "value": "={{ $json[\"action\"] }}"
                        },
                        {
                            "name": "data",
                            "value": "={{ $json[\"data\"] }}"
                        },
                        {
                            "name": "webhook_url",
                            "value": "={{ $json[\"webhook_url\"] }}"
                        }
                    ]
                },
                "options": {
                    "timeout": 300000
                }
            },
            "name": "Call Trend Scout Agent",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 3,
            "position": [450, 300]
        }

async def main():
    """Test the agent"""
    agent = TrendScoutAgent()
    
    # Test discover trends
    request = AgentRequest(
        action="discover_trends",
        data={
            "categories": ["security", "tech"],
            "limit": 10
        }
    )
    
    response = await agent.process(request)
    print(f"Response: {json.dumps(response.dict(), indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())