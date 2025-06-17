#!/usr/bin/env python3
"""
Hashtag Optimizer Module for Hook-Crafter Agent
Generates platform-optimized hashtags with spam detection
"""

import asyncio
import json
import logging
from typing import List, Dict, Any, Set, Tuple
from datetime import datetime, timedelta
import redis
import openai
from collections import Counter
import re

logger = logging.getLogger(__name__)

class HashtagOptimizer:
    """Platform-specific hashtag optimization"""
    
    def __init__(self, openai_api_key: str, redis_client: redis.Redis):
        self.openai_client = openai.AsyncOpenAI(api_key=openai_api_key)
        self.redis_client = redis_client
        
        # Platform-specific limits and strategies
        self.platform_configs = {
            'tiktok': {
                'max_hashtags': 5,
                'optimal_count': 3,
                'strategy': 'trending_niche_mix',
                'character_limit': 100
            },
            'instagram': {
                'max_hashtags': 30,
                'optimal_count': 15,
                'power_tags_limit': 3,
                'strategy': 'ladder_method',
                'character_limit': 2200
            },
            'youtube': {
                'max_hashtags': 15,
                'optimal_count': 5,
                'strategy': 'keyword_focused',
                'character_limit': 500
            },
            'twitter': {
                'max_hashtags': 2,
                'optimal_count': 2,
                'strategy': 'concise_trending',
                'character_limit': 280
            }
        }
        
        # Banned/overused hashtags cache
        self.banned_hashtags_ttl = 86400  # 24 hours
        
    async def generate_hashtags(self, content_data: Dict[str, Any], 
                              platform: str) -> Dict[str, Any]:
        """Generate optimized hashtags for content and platform"""
        logger.info(f"Generating hashtags for {platform}")
        
        # Get platform config
        config = self.platform_configs.get(platform, self.platform_configs['tiktok'])
        
        # Extract content context
        context = {
            'topic': content_data.get('topic', ''),
            'hook': content_data.get('hook_text', ''),
            'transcript': content_data.get('transcript_snippet', ''),
            'target_audience': content_data.get('target_audience', ''),
            'content_type': content_data.get('content_type', ''),
            'brand_pillars': content_data.get('brand_pillars', [])
        }
        
        # Generate hashtags based on strategy
        if config['strategy'] == 'trending_niche_mix':
            hashtags = await self._trending_niche_strategy(context, platform, config)
        elif config['strategy'] == 'ladder_method':
            hashtags = await self._ladder_strategy(context, platform, config)
        elif config['strategy'] == 'keyword_focused':
            hashtags = await self._keyword_strategy(context, platform, config)
        else:
            hashtags = await self._concise_trending_strategy(context, platform, config)
        
        # Filter banned/overused hashtags
        filtered_hashtags = await self._filter_hashtags(hashtags, platform)
        
        # Optimize count
        final_hashtags = self._optimize_hashtag_count(filtered_hashtags, config)
        
        # Calculate metrics
        metrics = self._calculate_hashtag_metrics(final_hashtags, platform)
        
        return {
            'hashtags': final_hashtags,
            'platform': platform,
            'strategy_used': config['strategy'],
            'metrics': metrics,
            'formatted_string': ' '.join([f'#{tag}' for tag in final_hashtags])
        }
    
    async def _trending_niche_strategy(self, context: Dict[str, Any], 
                                     platform: str, config: Dict[str, Any]) -> List[str]:
        """TikTok strategy: Mix of trending and niche hashtags"""
        prompt = f"""Generate {config['optimal_count']} hashtags for TikTok content.
        
Content Context:
- Topic: {context['topic']}
- Hook: {context['hook']}
- Target Audience: {context['target_audience']}
- Content Type: {context['content_type']}

Strategy: Include 1-2 broad trending hashtags and 2-3 specific niche hashtags.
Focus on discovery and algorithm optimization.

Output only the hashtags without # symbol, one per line."""

        response = await self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=100
        )
        
        hashtags = response.choices[0].message.content.strip().split('\n')
        return [tag.strip().replace('#', '') for tag in hashtags if tag.strip()]
    
    async def _ladder_strategy(self, context: Dict[str, Any], 
                             platform: str, config: Dict[str, Any]) -> List[str]:
        """Instagram strategy: Ladder method with different competition levels"""
        prompt = f"""Generate {config['optimal_count']} Instagram hashtags using the ladder method.
        
Content Context:
- Topic: {context['topic']}
- Hook: {context['hook']}
- Target Audience: {context['target_audience']}
- Brand Pillars: {', '.join(context['brand_pillars'])}

Strategy:
- 3 high-competition hashtags (1M+ posts) - max reach
- 5 medium-competition hashtags (100K-1M posts) - good discovery
- 5 low-competition hashtags (10K-100K posts) - high ranking chance
- 2 branded/unique hashtags

Limit "power tags" (10M+ posts) to maximum {config['power_tags_limit']}.

Output only the hashtags without # symbol, one per line."""

        response = await self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200
        )
        
        hashtags = response.choices[0].message.content.strip().split('\n')
        return [tag.strip().replace('#', '') for tag in hashtags if tag.strip()]
    
    async def _keyword_strategy(self, context: Dict[str, Any], 
                              platform: str, config: Dict[str, Any]) -> List[str]:
        """YouTube strategy: Keyword-focused for search"""
        prompt = f"""Generate {config['optimal_count']} YouTube hashtags for search optimization.
        
Content Context:
- Topic: {context['topic']}
- Content Type: {context['content_type']}
- Target Audience: {context['target_audience']}

Strategy: Focus on searchable keywords and topic categories.
Include 1-2 broad category tags and 3-4 specific keyword tags.

Output only the hashtags without # symbol, one per line."""

        response = await self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=100
        )
        
        hashtags = response.choices[0].message.content.strip().split('\n')
        return [tag.strip().replace('#', '') for tag in hashtags if tag.strip()]
    
    async def _concise_trending_strategy(self, context: Dict[str, Any], 
                                       platform: str, config: Dict[str, Any]) -> List[str]:
        """Twitter strategy: Concise and trending"""
        prompt = f"""Generate exactly {config['optimal_count']} Twitter/X hashtags.
        
Content Context:
- Topic: {context['topic']}
- Hook: {context['hook']}

Strategy: Maximum 2 highly relevant, currently trending hashtags.
Keep them short and impactful.

Output only the hashtags without # symbol, one per line."""

        response = await self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=50
        )
        
        hashtags = response.choices[0].message.content.strip().split('\n')
        return [tag.strip().replace('#', '') for tag in hashtags[:2] if tag.strip()]
    
    async def _filter_hashtags(self, hashtags: List[str], platform: str) -> List[str]:
        """Filter out banned or overused hashtags"""
        # Get banned hashtags from cache
        banned_key = f"banned_hashtags:{platform}"
        banned_hashtags = self.redis_client.smembers(banned_key)
        
        if not banned_hashtags:
            # Load default banned list
            banned_hashtags = await self._load_banned_hashtags(platform)
        
        # Filter out banned and clean hashtags
        filtered = []
        for tag in hashtags:
            # Clean hashtag
            clean_tag = re.sub(r'[^a-zA-Z0-9]', '', tag.lower())
            
            # Skip if banned
            if clean_tag in banned_hashtags:
                logger.warning(f"Skipping banned hashtag: {tag}")
                continue
            
            # Skip if too generic
            if len(clean_tag) < 3 or clean_tag in ['the', 'and', 'for', 'you']:
                continue
            
            filtered.append(clean_tag)
        
        return filtered
    
    async def _load_banned_hashtags(self, platform: str) -> Set[str]:
        """Load platform-specific banned hashtags"""
        # Common banned/shadowbanned hashtags
        common_banned = {
            'follow4follow', 'f4f', 'followforfollow',
            'like4like', 'l4l', 'likeforlike',
            'follow', 'like', 'comment',
            'spam', 'adult', 'nsfw'
        }
        
        platform_specific = {
            'instagram': {
                'instagood', 'photooftheday', 'beautiful',
                'happy', 'cute', 'fashion', 'followme',
                'picoftheday', 'selfie', 'summer'  # Overused
            },
            'tiktok': {
                'foryou', 'foryoupage', 'fyp', 'viral',
                'trending', 'challenge'  # Too generic
            }
        }
        
        banned = common_banned.copy()
        banned.update(platform_specific.get(platform, set()))
        
        # Cache for 24 hours
        banned_key = f"banned_hashtags:{platform}"
        for tag in banned:
            self.redis_client.sadd(banned_key, tag)
        self.redis_client.expire(banned_key, self.banned_hashtags_ttl)
        
        return banned
    
    def _optimize_hashtag_count(self, hashtags: List[str], config: Dict[str, Any]) -> List[str]:
        """Optimize hashtag count based on platform best practices"""
        # Remove duplicates while preserving order
        seen = set()
        unique_hashtags = []
        for tag in hashtags:
            if tag not in seen:
                seen.add(tag)
                unique_hashtags.append(tag)
        
        # Limit to platform maximum
        return unique_hashtags[:config['max_hashtags']]
    
    def _calculate_hashtag_metrics(self, hashtags: List[str], platform: str) -> Dict[str, Any]:
        """Calculate hashtag performance metrics"""
        metrics = {
            'count': len(hashtags),
            'total_characters': sum(len(tag) + 1 for tag in hashtags),  # +1 for #
            'avg_length': sum(len(tag) for tag in hashtags) / len(hashtags) if hashtags else 0,
            'diversity_score': len(set(hashtags)) / len(hashtags) if hashtags else 0
        }
        
        # Platform-specific scoring
        config = self.platform_configs[platform]
        
        # Score based on optimal count
        count_score = 1.0 - abs(metrics['count'] - config['optimal_count']) / config['max_hashtags']
        metrics['optimization_score'] = count_score
        
        return metrics
    
    async def analyze_competitor_hashtags(self, competitor_posts: List[Dict[str, Any]], 
                                        platform: str) -> Dict[str, Any]:
        """Analyze competitor hashtag strategies"""
        all_hashtags = []
        
        for post in competitor_posts:
            hashtags = self._extract_hashtags(post.get('caption', ''))
            all_hashtags.extend(hashtags)
        
        # Count frequency
        hashtag_freq = Counter(all_hashtags)
        
        # Get top performing hashtags
        top_hashtags = hashtag_freq.most_common(20)
        
        # Analyze patterns
        patterns = {
            'most_used': [tag for tag, _ in top_hashtags[:10]],
            'avg_per_post': len(all_hashtags) / len(competitor_posts) if competitor_posts else 0,
            'unique_count': len(set(all_hashtags)),
            'frequency_distribution': dict(top_hashtags)
        }
        
        return patterns
    
    def _extract_hashtags(self, text: str) -> List[str]:
        """Extract hashtags from text"""
        hashtag_pattern = r'#(\w+)'
        matches = re.findall(hashtag_pattern, text)
        return [match.lower() for match in matches]
    
    async def generate_cta_variants(self, content_data: Dict[str, Any], 
                                  sentiment: str = 'neutral') -> Dict[str, str]:
        """Generate CTA variants based on audience sentiment"""
        prompt = f"""Generate 2 call-to-action (CTA) variants for social media content.
        
Content: {content_data.get('hook_text', '')}
Audience Sentiment: {sentiment}
Platform: {content_data.get('platform', 'general')}

Generate:
1. cta_positive: Upbeat, enthusiastic tone for positive sentiment
2. cta_cautionary: Thoughtful, serious tone for concerned sentiment

Each CTA should be under 50 characters.
Format: 
POSITIVE: [cta text]
CAUTIONARY: [cta text]"""

        response = await self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=100
        )
        
        content = response.choices[0].message.content
        
        # Parse response
        cta_variants = {}
        for line in content.split('\n'):
            if line.startswith('POSITIVE:'):
                cta_variants['cta_positive'] = line.replace('POSITIVE:', '').strip()
            elif line.startswith('CAUTIONARY:'):
                cta_variants['cta_cautionary'] = line.replace('CAUTIONARY:', '').strip()
        
        return cta_variants

# Integration function for Hook-Crafter enhancement
async def enhance_hook_crafter_with_hashtags(hook_data: Dict[str, Any],
                                            redis_client: redis.Redis,
                                            openai_key: str) -> Dict[str, Any]:
    """Enhance hook crafter with dynamic hashtag generation"""
    
    optimizer = HashtagOptimizer(openai_key, redis_client)
    
    # Generate hashtags for each platform
    platform_hashtags = {}
    
    for platform in ['tiktok', 'instagram', 'youtube', 'twitter']:
        result = await optimizer.generate_hashtags(hook_data, platform)
        platform_hashtags[platform] = result
    
    # Get sentiment-based CTA variants
    sentiment = hook_data.get('audience_sentiment', 'neutral')
    cta_variants = await optimizer.generate_cta_variants(hook_data, sentiment)
    
    # Enhance hook data
    enhanced_data = hook_data.copy()
    enhanced_data['hashtags'] = platform_hashtags
    enhanced_data['cta_variants'] = cta_variants
    enhanced_data['hashtag_optimization'] = {
        'primary_platform': hook_data.get('platform', 'tiktok'),
        'cross_platform_ready': True,
        'total_variations': len(platform_hashtags)
    }
    
    return enhanced_data