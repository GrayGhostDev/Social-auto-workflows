#!/usr/bin/env python3
"""
Experiment-Manager Agent - A/B testing and variant optimization
Creates 2-4 micro-variants for each approved idea and tracks performance
"""

import asyncio
import json
import logging
import os
import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import redis
from notion_client import AsyncClient as NotionClient
from opentelemetry import trace
from opentelemetry.exporter.jaeger import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel, Field, validator
import numpy as np
from scipy import stats

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

class Variant(BaseModel):
    """A/B test variant configuration"""
    variant_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parent_uuid: str
    variant_type: str = Field(..., pattern="^(hook|thumbnail|audio|timing)$")
    changes: Dict[str, Any]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
class VariantResult(BaseModel):
    """Performance metrics for a variant"""
    variant_id: str
    metrics: Dict[str, float] = Field(default_factory=dict)
    sample_size: int = 0
    confidence_level: float = 0.0
    is_winner: bool = False
    tested_at: Optional[datetime] = None

class ExperimentConfig(BaseModel):
    """Configuration for an A/B test experiment"""
    experiment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parent_content_id: str
    variant_count: int = Field(default=3, ge=2, le=4)
    test_duration_minutes: int = Field(default=120)  # 2 hours
    success_metrics: List[str] = Field(default=["engagement_rate", "completion_rate", "share_rate"])
    minimum_sample_size: int = Field(default=100)
    confidence_threshold: float = Field(default=0.95)

class ExperimentManager:
    """Main agent class for A/B testing and variant management"""
    
    def __init__(self):
        self.notion_token = os.getenv('NOTION_API_TOKEN')
        self.notion_client = NotionClient(auth=self.notion_token) if self.notion_token else None
        self.variant_strategies = {
            'hook': self._generate_hook_variants,
            'thumbnail': self._generate_thumbnail_variants,
            'audio': self._generate_audio_variants,
            'timing': self._generate_timing_variants
        }
        
    @tracer.start_as_current_span("create_experiment")
    async def create_experiment(self, content_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create an A/B test experiment with multiple variants"""
        logger.info(f"Creating experiment for content: {content_data.get('id')}")
        
        # Create experiment configuration
        config = ExperimentConfig(
            parent_content_id=content_data.get('id'),
            variant_count=min(4, max(2, content_data.get('variant_count', 3)))
        )
        
        # Generate variants based on content type
        variants = await self._generate_variants(content_data, config)
        
        # Store experiment metadata
        experiment_data = {
            'experiment_id': config.experiment_id,
            'parent_content_id': config.parent_content_id,
            'variants': [v.dict() for v in variants],
            'config': config.dict(),
            'status': 'active',
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Cache in Redis
        redis_key = f"experiment:{config.experiment_id}"
        redis_client.setex(
            redis_key,
            timedelta(days=7),
            json.dumps(experiment_data, default=str)
        )
        
        # Update Notion if available
        if self.notion_client:
            await self._update_notion_variants(content_data.get('notion_id'), variants)
        
        return {
            'status': 'success',
            'experiment_id': config.experiment_id,
            'variants': [
                {
                    'variant_id': v.variant_id,
                    'type': v.variant_type,
                    'changes': v.changes
                } for v in variants
            ],
            'test_duration_minutes': config.test_duration_minutes
        }
    
    async def _generate_variants(self, content_data: Dict[str, Any], config: ExperimentConfig) -> List[Variant]:
        """Generate content variants based on type"""
        variants = []
        
        # Determine which variant types to create
        content_type = content_data.get('content_type', 'video')
        
        if content_type in ['video', 'reel', 'short']:
            # For video content, vary hook text and thumbnail
            hook_variants = await self._generate_hook_variants(content_data, 2)
            variants.extend(hook_variants)
            
            thumb_variants = await self._generate_thumbnail_variants(content_data, config.variant_count - 2)
            variants.extend(thumb_variants)
        else:
            # For other content, focus on hook text
            hook_variants = await self._generate_hook_variants(content_data, config.variant_count)
            variants.extend(hook_variants)
        
        return variants[:config.variant_count]
    
    async def _generate_hook_variants(self, content_data: Dict[str, Any], count: int) -> List[Variant]:
        """Generate hook text variants"""
        original_hook = content_data.get('hook', '')
        variants = []
        
        # Different hook strategies
        strategies = [
            lambda h: h.replace('?', '!'),  # Question to exclamation
            lambda h: f"🚨 {h}",  # Add urgency emoji
            lambda h: h.upper()[:30] + '...',  # All caps truncated
            lambda h: f"You won't believe {h.lower()}"  # Clickbait style
        ]
        
        for i in range(min(count, len(strategies))):
            variant_hook = strategies[i](original_hook)
            
            variants.append(Variant(
                parent_uuid=content_data.get('id'),
                variant_type='hook',
                changes={
                    'hook_text': variant_hook,
                    'strategy': f'hook_strategy_{i}'
                }
            ))
        
        return variants
    
    async def _generate_thumbnail_variants(self, content_data: Dict[str, Any], count: int) -> List[Variant]:
        """Generate thumbnail variants"""
        variants = []
        
        # Thumbnail variation strategies
        for i in range(count):
            variants.append(Variant(
                parent_uuid=content_data.get('id'),
                variant_type='thumbnail',
                changes={
                    'frame_second': random.choice([1, 3, 5]),  # Different frame times
                    'overlay_text': random.choice([True, False]),
                    'emotion_target': random.choice(['surprise', 'joy', 'curiosity'])
                }
            ))
        
        return variants
    
    async def _generate_audio_variants(self, content_data: Dict[str, Any], count: int) -> List[Variant]:
        """Generate audio track variants"""
        # Placeholder - would integrate with Trending-Audio Agent
        return []
    
    async def _generate_timing_variants(self, content_data: Dict[str, Any], count: int) -> List[Variant]:
        """Generate posting time variants"""
        variants = []
        base_time = datetime.utcnow()
        
        for i in range(count):
            offset_minutes = i * 15  # 15-minute intervals
            variants.append(Variant(
                parent_uuid=content_data.get('id'),
                variant_type='timing',
                changes={
                    'publish_offset_minutes': offset_minutes,
                    'slot': f'slot_{i}'
                }
            ))
        
        return variants
    
    @tracer.start_as_current_span("analyze_results")
    async def analyze_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """Analyze experiment results and determine winner"""
        logger.info(f"Analyzing experiment: {experiment_id}")
        
        # Retrieve experiment data
        redis_key = f"experiment:{experiment_id}"
        experiment_data = redis_client.get(redis_key)
        
        if not experiment_data:
            return {'status': 'error', 'message': 'Experiment not found'}
        
        experiment = json.loads(experiment_data)
        
        # Collect metrics for each variant
        variant_results = []
        
        for variant in experiment['variants']:
            metrics = await self._collect_variant_metrics(variant['variant_id'])
            
            result = VariantResult(
                variant_id=variant['variant_id'],
                metrics=metrics,
                sample_size=metrics.get('views', 0),
                tested_at=datetime.utcnow()
            )
            
            variant_results.append(result)
        
        # Statistical analysis to determine winner
        winner = await self._determine_winner(variant_results, experiment['config'])
        
        # Mark winner and archive losers
        await self._finalize_experiment(experiment_id, winner, variant_results)
        
        return {
            'status': 'success',
            'experiment_id': experiment_id,
            'winner': {
                'variant_id': winner.variant_id,
                'metrics': winner.metrics,
                'confidence_level': winner.confidence_level
            } if winner else None,
            'all_results': [r.dict() for r in variant_results]
        }
    
    async def _collect_variant_metrics(self, variant_id: str) -> Dict[str, float]:
        """Collect performance metrics for a variant"""
        # In production, this would query analytics APIs
        # For now, simulate with realistic data
        
        base_engagement = 0.05  # 5% baseline
        variance = random.uniform(-0.02, 0.03)
        
        return {
            'views': random.randint(100, 1000),
            'engagement_rate': max(0, base_engagement + variance),
            'completion_rate': max(0, 0.65 + random.uniform(-0.1, 0.15)),
            'share_rate': max(0, 0.02 + random.uniform(-0.01, 0.02)),
            'comment_rate': max(0, 0.01 + random.uniform(-0.005, 0.01))
        }
    
    async def _determine_winner(self, results: List[VariantResult], config: dict) -> Optional[VariantResult]:
        """Use statistical analysis to determine winning variant"""
        if not results or len(results) < 2:
            return None
        
        # Extract engagement rates for analysis
        engagement_rates = [(r.metrics.get('engagement_rate', 0), r.sample_size) for r in results]
        
        # Find variant with highest engagement
        best_idx = np.argmax([er[0] for er in engagement_rates])
        best_result = results[best_idx]
        
        # Calculate statistical significance using Chi-squared test
        control_rate = engagement_rates[0][0]
        control_size = engagement_rates[0][1]
        
        for i, result in enumerate(results[1:], 1):
            variant_rate = engagement_rates[i][0]
            variant_size = engagement_rates[i][1]
            
            # Simple proportion test
            if variant_size >= config['minimum_sample_size']:
                # Calculate z-score
                pooled_rate = (control_rate * control_size + variant_rate * variant_size) / (control_size + variant_size)
                se = np.sqrt(pooled_rate * (1 - pooled_rate) * (1/control_size + 1/variant_size))
                
                if se > 0:
                    z_score = (variant_rate - control_rate) / se
                    p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))
                    
                    confidence = 1 - p_value
                    result.confidence_level = confidence
                    
                    if confidence >= config['confidence_threshold'] and variant_rate > control_rate:
                        result.is_winner = True
                        return result
        
        # If no statistical significance, return highest performer
        best_result.is_winner = True
        return best_result
    
    async def _update_notion_variants(self, notion_page_id: str, variants: List[Variant]):
        """Update Notion with variant information"""
        if not self.notion_client or not notion_page_id:
            return
        
        try:
            # Update Notion page with variant data
            properties = {
                'variant_count': len(variants),
                'variant_ids': ','.join([v.variant_id for v in variants]),
                'experiment_status': 'active'
            }
            
            await self.notion_client.pages.update(
                page_id=notion_page_id,
                properties=properties
            )
        except Exception as e:
            logger.error(f"Failed to update Notion: {e}")
    
    async def _finalize_experiment(self, experiment_id: str, winner: VariantResult, all_results: List[VariantResult]):
        """Finalize experiment by marking winner and archiving losers"""
        # Update experiment status
        redis_key = f"experiment:{experiment_id}"
        experiment_data = json.loads(redis_client.get(redis_key))
        
        experiment_data['status'] = 'completed'
        experiment_data['completed_at'] = datetime.utcnow().isoformat()
        experiment_data['winner_id'] = winner.variant_id if winner else None
        experiment_data['final_results'] = [r.dict() for r in all_results]
        
        # Store updated experiment
        redis_client.setex(
            redis_key,
            timedelta(days=30),  # Keep for 30 days
            json.dumps(experiment_data, default=str)
        )
        
        # Send winner notification
        if winner:
            await self._notify_winner(experiment_id, winner)
    
    async def _notify_winner(self, experiment_id: str, winner: VariantResult):
        """Send notification about winning variant"""
        notification = {
            'type': 'experiment_complete',
            'experiment_id': experiment_id,
            'winner_id': winner.variant_id,
            'improvement': {
                'engagement_rate': f"+{(winner.metrics.get('engagement_rate', 0) - 0.05) * 100:.1f}%",
                'confidence': f"{winner.confidence_level * 100:.1f}%"
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Publish to notification stream
        redis_client.xadd('mcp:notifications', notification)
    
    @tracer.start_as_current_span("process_request")
    async def process(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing method for agent requests"""
        action = request.get('action', 'create')
        
        if action == 'create':
            return await self.create_experiment(request.get('content_data', {}))
        elif action == 'analyze':
            return await self.analyze_experiment(request.get('experiment_id'))
        else:
            return {'status': 'error', 'message': f'Unknown action: {action}'}

async def main():
    """Main entry point for the agent"""
    logger.info("Experiment-Manager Agent starting...")
    
    # Create agent instance
    manager = ExperimentManager()
    
    # Example request
    request = {
        'action': 'create',
        'content_data': {
            'id': 'content-123',
            'content_type': 'video',
            'hook': 'Is your security up to date?',
            'notion_id': 'notion-page-456',
            'variant_count': 3
        }
    }
    
    # Process request
    result = await manager.process(request)
    
    # Output result
    print(json.dumps(result, indent=2))
    
    # Simulate analyzing after some time
    if result.get('status') == 'success':
        await asyncio.sleep(2)  # In production, wait for actual duration
        
        analysis_request = {
            'action': 'analyze',
            'experiment_id': result.get('experiment_id')
        }
        
        analysis_result = await manager.process(analysis_request)
        print("\nAnalysis Result:")
        print(json.dumps(analysis_result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())