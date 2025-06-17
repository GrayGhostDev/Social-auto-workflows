#!/usr/bin/env python3
"""
Retention-Predictor Agent - ML-based prediction of video completion rates
Uses gradient boosting to predict retention and provide optimization feedback
"""

import asyncio
import json
import logging
import os
import pickle
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

import redis
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
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

class VideoMetadata(BaseModel):
    """Video content metadata for prediction"""
    video_id: str
    duration_seconds: int = Field(..., ge=5, le=300)
    platform: str = Field(..., pattern="^(tiktok|instagram|youtube|twitter)$")
    content_type: str
    hook_text: str
    first_3_seconds_transcript: str
    scene_changes_first_5s: int = Field(default=1, ge=0)
    text_overlay_count: int = Field(default=0, ge=0)
    music_energy_level: float = Field(default=0.5, ge=0.0, le=1.0)
    faces_detected: bool = Field(default=False)
    emotion_detected: Optional[str] = None
    hashtag_count: int = Field(default=0, ge=0)
    
class RetentionPrediction(BaseModel):
    """Retention prediction results"""
    video_id: str
    predicted_retention_rate: float = Field(..., ge=0.0, le=1.0)
    confidence_interval: Tuple[float, float]
    risk_level: str = Field(..., pattern="^(low|medium|high)$")
    optimization_suggestions: List[str]
    feature_importance: Dict[str, float]
    predicted_at: datetime = Field(default_factory=datetime.utcnow)

class RetentionPredictor:
    """ML-based retention prediction agent"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
        self.model_version = "1.0.0"
        self.model_path = os.getenv('MODEL_PATH', '/tmp/retention_model.pkl')
        self.retention_threshold = float(os.getenv('RETENTION_THRESHOLD', '0.65'))
        
        # Feature engineering parameters
        self.feature_names = [
            'duration_seconds', 'scene_changes_per_second', 'text_overlay_density',
            'music_energy_level', 'has_faces', 'emotion_score', 'hashtag_density',
            'hook_length', 'transcript_complexity', 'platform_tiktok', 'platform_instagram',
            'platform_youtube', 'platform_twitter'
        ]
        
        # Load or initialize model
        self._load_or_create_model()
    
    def _load_or_create_model(self):
        """Load existing model or create new one"""
        try:
            if os.path.exists(self.model_path):
                with open(self.model_path, 'rb') as f:
                    model_data = pickle.load(f)
                    self.model = model_data['model']
                    self.scaler = model_data['scaler']
                    self.vectorizer = model_data['vectorizer']
                    logger.info(f"Loaded existing model version {model_data.get('version', 'unknown')}")
            else:
                self._create_new_model()
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self._create_new_model()
    
    def _create_new_model(self):
        """Create and train new model with synthetic data"""
        logger.info("Creating new retention prediction model")
        
        # Generate synthetic training data
        X, y = self._generate_synthetic_data(1000)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train gradient boosting model
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42,
            min_samples_split=5,
            min_samples_leaf=3
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        train_score = self.model.score(X_train_scaled, y_train)
        test_score = self.model.score(X_test_scaled, y_test)
        
        logger.info(f"Model trained - Train R²: {train_score:.3f}, Test R²: {test_score:.3f}")
        
        # Save model
        self._save_model()
    
    def _generate_synthetic_data(self, n_samples: int) -> Tuple[np.ndarray, np.ndarray]:
        """Generate synthetic training data based on platform patterns"""
        np.random.seed(42)
        
        data = []
        targets = []
        
        for _ in range(n_samples):
            # Generate features
            duration = np.random.randint(10, 180)
            scene_changes = np.random.poisson(3) / duration * 5  # Changes per 5 seconds
            text_overlays = np.random.poisson(2)
            music_energy = np.random.beta(2, 2)  # Bell curve around 0.5
            has_faces = np.random.random() > 0.3
            emotion_score = np.random.random() if has_faces else 0
            hashtags = np.random.poisson(5)
            hook_length = np.random.randint(5, 50)
            transcript_complexity = np.random.random()
            
            # Platform one-hot encoding
            platform = np.random.choice(['tiktok', 'instagram', 'youtube', 'twitter'])
            platform_features = [
                1 if platform == 'tiktok' else 0,
                1 if platform == 'instagram' else 0,
                1 if platform == 'youtube' else 0,
                1 if platform == 'twitter' else 0
            ]
            
            features = [
                duration,
                scene_changes,
                text_overlays / duration * 60,  # Density per minute
                music_energy,
                int(has_faces),
                emotion_score,
                hashtags / 30,  # Density
                hook_length,
                transcript_complexity
            ] + platform_features
            
            # Generate target retention based on features
            # This simulates real-world patterns
            retention = 0.5  # Base retention
            
            # Platform effects
            if platform == 'tiktok':
                retention += 0.1
            elif platform == 'youtube':
                retention -= 0.05
            
            # Feature effects
            if duration < 30:
                retention += 0.15  # Short videos retain better
            elif duration > 120:
                retention -= 0.2
            
            if scene_changes > 0.5:
                retention += 0.1  # Dynamic content
            
            if music_energy > 0.7:
                retention += 0.05
            
            if has_faces and emotion_score > 0.7:
                retention += 0.1
            
            if hook_length < 15:
                retention += 0.05  # Concise hooks
            
            # Add noise
            retention += np.random.normal(0, 0.1)
            retention = np.clip(retention, 0, 1)
            
            data.append(features)
            targets.append(retention)
        
        return np.array(data), np.array(targets)
    
    def _save_model(self):
        """Save model to disk"""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'vectorizer': self.vectorizer,
            'version': self.model_version,
            'trained_at': datetime.utcnow().isoformat(),
            'feature_names': self.feature_names
        }
        
        with open(self.model_path, 'wb') as f:
            pickle.dump(model_data, f)
        
        logger.info(f"Model saved to {self.model_path}")
    
    @tracer.start_as_current_span("extract_features")
    def _extract_features(self, metadata: VideoMetadata) -> np.ndarray:
        """Extract features from video metadata"""
        # Basic features
        features = [
            metadata.duration_seconds,
            metadata.scene_changes_first_5s / 5.0,  # Changes per second
            metadata.text_overlay_count / metadata.duration_seconds * 60,  # Per minute
            metadata.music_energy_level,
            int(metadata.faces_detected),
            self._emotion_to_score(metadata.emotion_detected),
            metadata.hashtag_count / 30,  # Normalized
            len(metadata.hook_text.split()),
            self._calculate_text_complexity(metadata.first_3_seconds_transcript)
        ]
        
        # Platform one-hot encoding
        platform_features = [
            1 if metadata.platform == 'tiktok' else 0,
            1 if metadata.platform == 'instagram' else 0,
            1 if metadata.platform == 'youtube' else 0,
            1 if metadata.platform == 'twitter' else 0
        ]
        
        features.extend(platform_features)
        
        return np.array(features).reshape(1, -1)
    
    def _emotion_to_score(self, emotion: Optional[str]) -> float:
        """Convert emotion to numerical score"""
        if not emotion:
            return 0.0
        
        emotion_scores = {
            'joy': 0.9,
            'surprise': 0.85,
            'curiosity': 0.8,
            'excitement': 0.85,
            'neutral': 0.5,
            'sadness': 0.3,
            'anger': 0.4
        }
        
        return emotion_scores.get(emotion.lower(), 0.5)
    
    def _calculate_text_complexity(self, text: str) -> float:
        """Calculate text complexity score"""
        if not text:
            return 0.0
        
        words = text.split()
        if not words:
            return 0.0
        
        # Simple complexity: average word length
        avg_word_length = sum(len(word) for word in words) / len(words)
        
        # Normalize to 0-1 range
        return min(avg_word_length / 10, 1.0)
    
    @tracer.start_as_current_span("predict_retention")
    async def predict_retention(self, metadata: VideoMetadata) -> RetentionPrediction:
        """Predict video retention rate"""
        logger.info(f"Predicting retention for video: {metadata.video_id}")
        
        # Extract features
        features = self._extract_features(metadata)
        
        # Scale features
        features_scaled = self.scaler.transform(features)
        
        # Make prediction
        predicted_retention = float(self.model.predict(features_scaled)[0])
        predicted_retention = np.clip(predicted_retention, 0, 1)
        
        # Calculate confidence interval using model's estimators
        if hasattr(self.model, 'estimators_'):
            predictions = [est.predict(features_scaled)[0] for est in self.model.estimators_]
            std_dev = np.std(predictions)
            confidence_interval = (
                max(0, predicted_retention - 1.96 * std_dev),
                min(1, predicted_retention + 1.96 * std_dev)
            )
        else:
            # Default confidence interval
            confidence_interval = (
                max(0, predicted_retention - 0.1),
                min(1, predicted_retention + 0.1)
            )
        
        # Determine risk level
        if predicted_retention >= self.retention_threshold:
            risk_level = "low"
        elif predicted_retention >= self.retention_threshold - 0.1:
            risk_level = "medium"
        else:
            risk_level = "high"
        
        # Get feature importance
        feature_importance = self._get_feature_importance(features_scaled[0])
        
        # Generate optimization suggestions
        suggestions = self._generate_suggestions(metadata, predicted_retention, feature_importance)
        
        prediction = RetentionPrediction(
            video_id=metadata.video_id,
            predicted_retention_rate=predicted_retention,
            confidence_interval=confidence_interval,
            risk_level=risk_level,
            optimization_suggestions=suggestions,
            feature_importance=feature_importance
        )
        
        # Cache prediction
        cache_key = f"retention_prediction:{metadata.video_id}"
        redis_client.setex(
            cache_key,
            timedelta(hours=24),
            json.dumps(prediction.dict(), default=str)
        )
        
        return prediction
    
    def _get_feature_importance(self, features: np.ndarray) -> Dict[str, float]:
        """Get feature importance for prediction"""
        if not hasattr(self.model, 'feature_importances_'):
            return {}
        
        importance_dict = {}
        for i, name in enumerate(self.feature_names):
            if i < len(self.model.feature_importances_):
                importance_dict[name] = float(self.model.feature_importances_[i])
        
        # Sort by importance
        importance_dict = dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
        
        return importance_dict
    
    def _generate_suggestions(self, metadata: VideoMetadata, predicted_retention: float, 
                            feature_importance: Dict[str, float]) -> List[str]:
        """Generate optimization suggestions based on prediction"""
        suggestions = []
        
        # Check if retention is below threshold
        if predicted_retention < self.retention_threshold:
            
            # Duration-based suggestions
            if metadata.duration_seconds > 60:
                suggestions.append("Consider shortening video to under 60 seconds for better retention")
            
            # Hook suggestions
            if len(metadata.hook_text.split()) > 15:
                suggestions.append("Tighten first 2 seconds - hook text is too long")
            
            # Visual engagement
            if metadata.scene_changes_first_5s < 2:
                suggestions.append("Add more dynamic cuts in first 5 seconds to maintain attention")
            
            if not metadata.faces_detected:
                suggestions.append("Consider adding human faces for emotional connection")
            
            # Platform-specific
            if metadata.platform == 'tiktok' and metadata.music_energy_level < 0.6:
                suggestions.append("Use higher energy trending audio for TikTok audience")
            
            # Text overlay
            if metadata.text_overlay_count == 0:
                suggestions.append("Add text overlays to reinforce key points")
            elif metadata.text_overlay_count > 5:
                suggestions.append("Reduce text overlays to avoid overwhelming viewers")
        
        # If no specific suggestions, provide general guidance
        if not suggestions:
            if predicted_retention >= 0.8:
                suggestions.append("Content is optimized for high retention - maintain current approach")
            else:
                suggestions.append("Content is performing adequately - minor optimizations may help")
        
        return suggestions[:5]  # Limit to top 5 suggestions
    
    @tracer.start_as_current_span("update_model")
    async def update_model(self, historical_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update model with new historical performance data"""
        logger.info(f"Updating model with {len(historical_data)} new data points")
        
        if len(historical_data) < 50:
            return {
                'status': 'skipped',
                'reason': 'Insufficient data for update (minimum 50 samples required)'
            }
        
        # Prepare training data
        X = []
        y = []
        
        for record in historical_data:
            metadata = VideoMetadata(**record['metadata'])
            features = self._extract_features(metadata)
            X.append(features[0])
            y.append(record['actual_retention'])
        
        X = np.array(X)
        y = np.array(y)
        
        # Combine with existing synthetic data for stability
        X_synthetic, y_synthetic = self._generate_synthetic_data(500)
        X_combined = np.vstack([X, X_synthetic])
        y_combined = np.hstack([y, y_synthetic])
        
        # Retrain model
        X_scaled = self.scaler.fit_transform(X_combined)
        
        self.model = GradientBoostingRegressor(
            n_estimators=150,  # More trees for production
            learning_rate=0.1,
            max_depth=6,
            random_state=42,
            min_samples_split=5,
            min_samples_leaf=3
        )
        
        self.model.fit(X_scaled, y_combined)
        
        # Evaluate on recent data
        X_recent_scaled = self.scaler.transform(X)
        score = self.model.score(X_recent_scaled, y)
        
        # Update version and save
        self.model_version = f"1.{int(self.model_version.split('.')[1]) + 1}.0"
        self._save_model()
        
        return {
            'status': 'success',
            'new_version': self.model_version,
            'model_score': float(score),
            'samples_used': len(historical_data),
            'updated_at': datetime.utcnow().isoformat()
        }
    
    @tracer.start_as_current_span("calculate_viral_score")
    async def calculate_viral_score(self, metadata: VideoMetadata, 
                                  first_hour_metrics: Optional[Dict[str, float]] = None) -> float:
        """Calculate viral probability score combining retention and early metrics"""
        # Get retention prediction
        retention_pred = await self.predict_retention(metadata)
        
        # Base score from retention
        viral_score = retention_pred.predicted_retention_rate * 50  # 50% weight
        
        # Add first-hour metrics if available
        if first_hour_metrics:
            engagement_rate = first_hour_metrics.get('engagement_rate', 0)
            share_rate = first_hour_metrics.get('share_rate', 0)
            comment_rate = first_hour_metrics.get('comment_rate', 0)
            
            # Normalize and weight metrics
            engagement_score = min(engagement_rate / 0.1, 1.0) * 20  # 20% weight
            share_score = min(share_rate / 0.05, 1.0) * 20  # 20% weight
            comment_score = min(comment_rate / 0.02, 1.0) * 10  # 10% weight
            
            viral_score += engagement_score + share_score + comment_score
        
        return min(viral_score, 100)  # Cap at 100
    
    @tracer.start_as_current_span("process_request")
    async def process(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing method for agent requests"""
        action = request.get('action', 'predict')
        
        if action == 'predict':
            # Predict retention for video
            metadata_dict = request.get('metadata')
            if not metadata_dict:
                return {'status': 'error', 'message': 'No metadata provided'}
            
            try:
                metadata = VideoMetadata(**metadata_dict)
                prediction = await self.predict_retention(metadata)
                
                return {
                    'status': 'success',
                    'prediction': {
                        'video_id': prediction.video_id,
                        'retention_rate': prediction.predicted_retention_rate,
                        'confidence_interval': prediction.confidence_interval,
                        'risk_level': prediction.risk_level,
                        'suggestions': prediction.optimization_suggestions,
                        'top_features': dict(list(prediction.feature_importance.items())[:5])
                    }
                }
            except Exception as e:
                logger.error(f"Prediction error: {e}")
                return {'status': 'error', 'message': str(e)}
                
        elif action == 'viral_score':
            # Calculate viral probability
            metadata_dict = request.get('metadata')
            first_hour_metrics = request.get('first_hour_metrics')
            
            if not metadata_dict:
                return {'status': 'error', 'message': 'No metadata provided'}
            
            try:
                metadata = VideoMetadata(**metadata_dict)
                viral_score = await self.calculate_viral_score(metadata, first_hour_metrics)
                
                return {
                    'status': 'success',
                    'viral_score': viral_score,
                    'recommendation': 'proceed' if viral_score >= 50 else 'review'
                }
            except Exception as e:
                logger.error(f"Viral score error: {e}")
                return {'status': 'error', 'message': str(e)}
                
        elif action == 'update_model':
            # Update model with new data
            historical_data = request.get('historical_data', [])
            result = await self.update_model(historical_data)
            return result
            
        else:
            return {'status': 'error', 'message': f'Unknown action: {action}'}

async def main():
    """Main entry point for the agent"""
    logger.info("Retention-Predictor Agent starting...")
    
    # Create agent instance
    predictor = RetentionPredictor()
    
    # Example: Predict retention
    metadata = {
        'video_id': 'test-video-123',
        'duration_seconds': 45,
        'platform': 'tiktok',
        'content_type': 'educational',
        'hook_text': 'You won\'t believe this security hack',
        'first_3_seconds_transcript': 'Did you know that most people use weak passwords?',
        'scene_changes_first_5s': 3,
        'text_overlay_count': 4,
        'music_energy_level': 0.8,
        'faces_detected': True,
        'emotion_detected': 'surprise',
        'hashtag_count': 5
    }
    
    request = {
        'action': 'predict',
        'metadata': metadata
    }
    
    result = await predictor.process(request)
    print("Retention Prediction:")
    print(json.dumps(result, indent=2))
    
    # Example: Calculate viral score
    viral_request = {
        'action': 'viral_score',
        'metadata': metadata,
        'first_hour_metrics': {
            'engagement_rate': 0.08,
            'share_rate': 0.03,
            'comment_rate': 0.015
        }
    }
    
    viral_result = await predictor.process(viral_request)
    print("\nViral Score:")
    print(json.dumps(viral_result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())