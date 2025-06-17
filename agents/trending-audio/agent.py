#!/usr/bin/env python3
"""
Trending-Audio Agent - Identifies and verifies trending audio for viral content
Scrapes TikTok sound charts and verifies commercial usage rights
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

import aiohttp
import redis
from opentelemetry import trace
from opentelemetry.exporter.jaeger import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel, Field, validator
from bs4 import BeautifulSoup

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

class TrendingAudio(BaseModel):
    """Trending audio track information"""
    audio_id: str
    platform: str = Field(..., pattern="^(tiktok|instagram|youtube)$")
    title: str
    artist: str
    rank: int
    usage_count: int
    trend_score: float = Field(..., ge=0.0, le=100.0)
    duration_seconds: int
    genre: Optional[str] = None
    mood: Optional[str] = None
    discovered_at: datetime = Field(default_factory=datetime.utcnow)

class AudioRights(BaseModel):
    """Audio rights and licensing information"""
    audio_id: str
    is_cleared: bool
    license_type: Optional[str] = None  # commercial, royalty-free, restricted
    restrictions: List[str] = Field(default_factory=list)
    rights_holder: Optional[str] = None
    license_cost: Optional[float] = None
    alternative_id: Optional[str] = None  # Fallback audio if not cleared

class AudioRecommendation(BaseModel):
    """Audio recommendation for content"""
    primary_audio: TrendingAudio
    rights: AudioRights
    match_score: float = Field(..., ge=0.0, le=1.0)
    reasoning: str
    fallback_options: List[Dict[str, Any]] = Field(default_factory=list)

class TrendingAudioAgent:
    """Agent for discovering and verifying trending audio"""
    
    def __init__(self):
        self.tiktok_api_key = os.getenv('TIKTOK_API_KEY')
        self.youtube_api_key = os.getenv('YOUTUBE_API_KEY')
        self.lickd_api_key = os.getenv('LICKD_API_KEY')
        self.rights_check_api = os.getenv('RIGHTS_CHECK_API', 'https://api.rightscheck.io')
        
        # Royalty-free music libraries
        self.royalty_free_sources = {
            'epidemic_sound': 'https://www.epidemicsound.com/api/v2',
            'artlist': 'https://api.artlist.io/v1',
            'youtube_audio_library': 'https://www.youtube.com/audiolibrary'
        }
        
        # Cache configuration
        self.cache_ttl = int(os.getenv('AUDIO_CACHE_TTL', '3600'))  # 1 hour
        
    @tracer.start_as_current_span("scrape_trending_audio")
    async def scrape_trending_audio(self, platform: str = 'tiktok', limit: int = 200) -> List[TrendingAudio]:
        """Scrape trending audio from platform"""
        logger.info(f"Scraping trending audio from {platform}")
        
        # Check cache first
        cache_key = f"trending_audio:{platform}:{datetime.utcnow().strftime('%Y%m%d%H')}"
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            logger.info("Using cached trending audio data")
            return [TrendingAudio(**item) for item in json.loads(cached_data)]
        
        # Scrape based on platform
        if platform == 'tiktok':
            audio_list = await self._scrape_tiktok_sounds(limit)
        elif platform == 'instagram':
            audio_list = await self._scrape_instagram_audio(limit)
        else:
            audio_list = await self._scrape_youtube_audio(limit)
        
        # Cache results
        if audio_list:
            redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps([a.dict() for a in audio_list], default=str)
            )
        
        return audio_list
    
    async def _scrape_tiktok_sounds(self, limit: int) -> List[TrendingAudio]:
        """Scrape TikTok trending sounds"""
        trending_audio = []
        
        # In production, this would use TikTok's API or web scraping
        # For now, simulate with realistic data
        mock_sounds = [
            {
                'title': 'Flowers - Miley Cyrus',
                'artist': 'Miley Cyrus',
                'usage_count': 2500000,
                'genre': 'pop',
                'mood': 'upbeat'
            },
            {
                'title': 'Creepin - Metro Boomin',
                'artist': 'Metro Boomin, The Weeknd',
                'usage_count': 1800000,
                'genre': 'hip-hop',
                'mood': 'dark'
            },
            {
                'title': 'Unholy - Sam Smith',
                'artist': 'Sam Smith, Kim Petras',
                'usage_count': 1500000,
                'genre': 'pop',
                'mood': 'energetic'
            }
        ]
        
        for i, sound in enumerate(mock_sounds[:limit]):
            audio = TrendingAudio(
                audio_id=f"tiktok_{i}_{datetime.utcnow().strftime('%Y%m%d')}",
                platform='tiktok',
                title=sound['title'],
                artist=sound['artist'],
                rank=i + 1,
                usage_count=sound['usage_count'],
                trend_score=100 - (i * 2),  # Decreasing score by rank
                duration_seconds=30,  # TikTok default
                genre=sound.get('genre'),
                mood=sound.get('mood')
            )
            trending_audio.append(audio)
        
        return trending_audio
    
    async def _scrape_instagram_audio(self, limit: int) -> List[TrendingAudio]:
        """Scrape Instagram Reels audio"""
        # Placeholder implementation
        return []
    
    async def _scrape_youtube_audio(self, limit: int) -> List[TrendingAudio]:
        """Scrape YouTube Shorts audio"""
        # Placeholder implementation
        return []
    
    @tracer.start_as_current_span("verify_audio_rights")
    async def verify_audio_rights(self, audio: TrendingAudio) -> AudioRights:
        """Verify commercial usage rights for audio"""
        logger.info(f"Verifying rights for audio: {audio.title}")
        
        # Check cache
        cache_key = f"audio_rights:{audio.audio_id}"
        cached_rights = redis_client.get(cache_key)
        
        if cached_rights:
            return AudioRights(**json.loads(cached_rights))
        
        # Check multiple sources for rights
        is_cleared = False
        license_type = None
        restrictions = []
        rights_holder = None
        license_cost = None
        
        # 1. Check YouTube Content ID
        youtube_check = await self._check_youtube_content_id(audio)
        if youtube_check['status'] == 'blocked':
            restrictions.append('youtube_blocked')
        elif youtube_check['status'] == 'monetized':
            restrictions.append('youtube_revenue_share')
        
        # 2. Check commercial licensing databases
        commercial_check = await self._check_commercial_licensing(audio)
        if commercial_check['available']:
            is_cleared = True
            license_type = commercial_check['license_type']
            rights_holder = commercial_check['rights_holder']
            license_cost = commercial_check.get('cost', 0)
        
        # 3. Find royalty-free alternative if not cleared
        alternative_id = None
        if not is_cleared:
            alternative = await self._find_royalty_free_alternative(audio)
            if alternative:
                alternative_id = alternative['audio_id']
        
        rights = AudioRights(
            audio_id=audio.audio_id,
            is_cleared=is_cleared,
            license_type=license_type,
            restrictions=restrictions,
            rights_holder=rights_holder,
            license_cost=license_cost,
            alternative_id=alternative_id
        )
        
        # Cache results
        redis_client.setex(
            cache_key,
            timedelta(days=7),
            json.dumps(rights.dict(), default=str)
        )
        
        return rights
    
    async def _check_youtube_content_id(self, audio: TrendingAudio) -> Dict[str, Any]:
        """Check YouTube Content ID system"""
        # In production, use YouTube API
        # Simulate response
        if 'copyright' in audio.title.lower():
            return {'status': 'blocked', 'reason': 'copyright_claim'}
        elif any(label in audio.artist.lower() for label in ['universal', 'sony', 'warner']):
            return {'status': 'monetized', 'claimant': audio.artist}
        else:
            return {'status': 'clear'}
    
    async def _check_commercial_licensing(self, audio: TrendingAudio) -> Dict[str, Any]:
        """Check commercial licensing databases"""
        # Check Lickd, Slip.stream, etc.
        # Simulate response
        
        # Major labels typically require licensing
        if any(label in audio.artist.lower() for label in ['universal', 'sony', 'warner']):
            return {
                'available': True,
                'license_type': 'commercial',
                'rights_holder': audio.artist,
                'cost': 99.99  # Monthly license
            }
        
        # Independent artists might be available
        return {
            'available': False,
            'reason': 'not_in_database'
        }
    
    async def _find_royalty_free_alternative(self, audio: TrendingAudio) -> Optional[Dict[str, Any]]:
        """Find royalty-free alternative with similar mood/genre"""
        logger.info(f"Finding royalty-free alternative for {audio.title}")
        
        # Search by mood and genre
        search_params = {
            'mood': audio.mood,
            'genre': audio.genre,
            'duration': audio.duration_seconds,
            'energy': 'high' if audio.trend_score > 80 else 'medium'
        }
        
        # In production, query royalty-free APIs
        # Simulate finding alternative
        alternatives = [
            {
                'audio_id': 'rf_upbeat_001',
                'title': 'Upbeat Corporate',
                'source': 'epidemic_sound',
                'match_score': 0.85
            },
            {
                'audio_id': 'rf_energetic_002',
                'title': 'Energetic Pop',
                'source': 'artlist',
                'match_score': 0.78
            }
        ]
        
        return alternatives[0] if alternatives else None
    
    @tracer.start_as_current_span("recommend_audio")
    async def recommend_audio(self, content_context: Dict[str, Any]) -> AudioRecommendation:
        """Recommend best audio for content based on trends and rights"""
        logger.info("Generating audio recommendation")
        
        # Get trending audio
        trending = await self.scrape_trending_audio('tiktok', limit=50)
        
        # Filter by content mood/theme
        content_mood = content_context.get('mood', 'neutral')
        content_genre = content_context.get('genre', 'any')
        
        # Score each audio option
        scored_options = []
        
        for audio in trending:
            # Check if audio matches content
            mood_match = 1.0 if audio.mood == content_mood else 0.5
            trend_weight = audio.trend_score / 100.0
            
            # Verify rights
            rights = await self.verify_audio_rights(audio)
            rights_weight = 1.0 if rights.is_cleared else 0.3
            
            # Calculate final score
            match_score = (mood_match * 0.3) + (trend_weight * 0.5) + (rights_weight * 0.2)
            
            scored_options.append({
                'audio': audio,
                'rights': rights,
                'score': match_score
            })
        
        # Sort by score
        scored_options.sort(key=lambda x: x['score'], reverse=True)
        
        # Get best option
        best_option = scored_options[0]
        
        # Prepare fallback options
        fallbacks = []
        for option in scored_options[1:4]:
            if option['rights'].is_cleared or option['rights'].alternative_id:
                fallbacks.append({
                    'audio_id': option['audio'].audio_id,
                    'title': option['audio'].title,
                    'score': option['score']
                })
        
        recommendation = AudioRecommendation(
            primary_audio=best_option['audio'],
            rights=best_option['rights'],
            match_score=best_option['score'],
            reasoning=self._generate_reasoning(best_option, content_context),
            fallback_options=fallbacks
        )
        
        return recommendation
    
    def _generate_reasoning(self, option: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Generate reasoning for audio selection"""
        audio = option['audio']
        rights = option['rights']
        
        reasons = []
        
        if audio.trend_score > 90:
            reasons.append(f"Currently ##{audio.rank} trending on {audio.platform}")
        
        if rights.is_cleared:
            reasons.append("Commercial rights cleared")
        elif rights.alternative_id:
            reasons.append("Royalty-free alternative available")
        
        if audio.mood == context.get('mood'):
            reasons.append(f"Perfect mood match ({audio.mood})")
        
        return ". ".join(reasons) if reasons else "Best available option based on current trends"
    
    @tracer.start_as_current_span("inject_audio_track")
    async def inject_audio_track(self, content_id: str, audio_recommendation: AudioRecommendation) -> Dict[str, Any]:
        """Inject selected audio into content pipeline"""
        logger.info(f"Injecting audio track for content: {content_id}")
        
        # Determine which audio to use
        if audio_recommendation.rights.is_cleared:
            audio_to_use = audio_recommendation.primary_audio.audio_id
            audio_source = 'licensed'
        elif audio_recommendation.rights.alternative_id:
            audio_to_use = audio_recommendation.rights.alternative_id
            audio_source = 'royalty_free'
        else:
            # Use silence or default background
            audio_to_use = 'default_background'
            audio_source = 'fallback'
        
        # Update content metadata
        injection_data = {
            'content_id': content_id,
            'audio_track_id': audio_to_use,
            'audio_source': audio_source,
            'audio_metadata': {
                'title': audio_recommendation.primary_audio.title,
                'artist': audio_recommendation.primary_audio.artist,
                'trend_score': audio_recommendation.primary_audio.trend_score,
                'platform': audio_recommendation.primary_audio.platform
            },
            'rights_status': 'cleared' if audio_recommendation.rights.is_cleared else 'alternative',
            'injection_timestamp': datetime.utcnow().isoformat()
        }
        
        # Store injection record
        redis_client.setex(
            f"audio_injection:{content_id}",
            timedelta(days=30),
            json.dumps(injection_data)
        )
        
        return {
            'status': 'success',
            'audio_track_id': audio_to_use,
            'source': audio_source,
            'metadata': injection_data
        }
    
    @tracer.start_as_current_span("process_request")
    async def process(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing method for agent requests"""
        action = request.get('action', 'recommend')
        
        if action == 'scrape':
            # Scrape trending audio
            platform = request.get('platform', 'tiktok')
            limit = request.get('limit', 200)
            
            trending = await self.scrape_trending_audio(platform, limit)
            
            return {
                'status': 'success',
                'platform': platform,
                'audio_count': len(trending),
                'top_10': [
                    {
                        'rank': a.rank,
                        'title': a.title,
                        'artist': a.artist,
                        'trend_score': a.trend_score
                    } for a in trending[:10]
                ]
            }
            
        elif action == 'verify':
            # Verify specific audio rights
            audio_data = request.get('audio')
            if not audio_data:
                return {'status': 'error', 'message': 'No audio data provided'}
            
            audio = TrendingAudio(**audio_data)
            rights = await self.verify_audio_rights(audio)
            
            return {
                'status': 'success',
                'audio_id': audio.audio_id,
                'rights': rights.dict()
            }
            
        elif action == 'recommend':
            # Recommend audio for content
            content_context = request.get('content_context', {})
            recommendation = await self.recommend_audio(content_context)
            
            return {
                'status': 'success',
                'recommendation': {
                    'audio_id': recommendation.primary_audio.audio_id,
                    'title': recommendation.primary_audio.title,
                    'artist': recommendation.primary_audio.artist,
                    'trend_score': recommendation.primary_audio.trend_score,
                    'is_cleared': recommendation.rights.is_cleared,
                    'match_score': recommendation.match_score,
                    'reasoning': recommendation.reasoning,
                    'fallbacks': recommendation.fallback_options
                }
            }
            
        elif action == 'inject':
            # Inject audio into content
            content_id = request.get('content_id')
            recommendation_data = request.get('recommendation')
            
            if not content_id or not recommendation_data:
                return {'status': 'error', 'message': 'Missing content_id or recommendation'}
            
            # Reconstruct recommendation object
            audio = TrendingAudio(**recommendation_data['primary_audio'])
            rights = AudioRights(**recommendation_data['rights'])
            recommendation = AudioRecommendation(
                primary_audio=audio,
                rights=rights,
                match_score=recommendation_data['match_score'],
                reasoning=recommendation_data['reasoning']
            )
            
            result = await self.inject_audio_track(content_id, recommendation)
            return result
            
        else:
            return {'status': 'error', 'message': f'Unknown action: {action}'}

async def main():
    """Main entry point for the agent"""
    logger.info("Trending-Audio Agent starting...")
    
    # Create agent instance
    agent = TrendingAudioAgent()
    
    # Example: Get trending audio
    scrape_request = {
        'action': 'scrape',
        'platform': 'tiktok',
        'limit': 10
    }
    
    scrape_result = await agent.process(scrape_request)
    print("Trending Audio:")
    print(json.dumps(scrape_result, indent=2))
    
    # Example: Recommend audio for content
    recommend_request = {
        'action': 'recommend',
        'content_context': {
            'mood': 'upbeat',
            'genre': 'tech',
            'target_audience': 'millennials',
            'content_type': 'educational'
        }
    }
    
    recommend_result = await agent.process(recommend_request)
    print("\nAudio Recommendation:")
    print(json.dumps(recommend_result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())