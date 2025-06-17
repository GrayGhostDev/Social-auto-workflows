#!/usr/bin/env python3
"""
Cover-Frame Selector Module for Visual-Composer Agent
Analyzes video frames to select optimal thumbnail/cover image
"""

import cv2
import numpy as np
from typing import List, Tuple, Dict, Any, Optional
from skimage.metrics import structural_similarity as ssim
import face_recognition
from PIL import Image
import logging
import os
import tempfile
from dataclasses import dataclass
import base64
import io

logger = logging.getLogger(__name__)

@dataclass
class FrameCandidate:
    """Candidate frame for thumbnail selection"""
    timestamp: float
    frame_index: int
    ssim_score: float
    face_count: int
    emotion_score: float
    text_readability_score: float
    composition_score: float
    overall_score: float
    frame_data: Optional[np.ndarray] = None
    
class CoverFrameSelector:
    """Selects optimal cover frame from video"""
    
    def __init__(self, openai_api_key: Optional[str] = None):
        self.openai_api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.frame_analysis_window = 5  # First 5 seconds
        self.candidates_per_second = 3  # Sample 3 frames per second
        
    async def select_cover_frame(self, video_path: str, 
                               headline_text: Optional[str] = None) -> Dict[str, Any]:
        """Select optimal cover frame from video"""
        logger.info(f"Analyzing video for cover frame: {video_path}")
        
        # Extract frame candidates
        candidates = await self._extract_frame_candidates(video_path)
        
        # Analyze each candidate
        analyzed_candidates = []
        for candidate in candidates:
            scores = await self._analyze_frame(candidate, headline_text)
            candidate.emotion_score = scores['emotion']
            candidate.text_readability_score = scores['readability']
            candidate.composition_score = scores['composition']
            candidate.overall_score = self._calculate_overall_score(scores)
            analyzed_candidates.append(candidate)
        
        # Sort by overall score
        analyzed_candidates.sort(key=lambda x: x.overall_score, reverse=True)
        
        # Get top candidate and alternatives
        best_frame = analyzed_candidates[0]
        alternatives = analyzed_candidates[1:4]  # Top 3 alternatives
        
        # Generate thumbnail from best frame
        thumbnail_data = await self._generate_thumbnail(best_frame, headline_text)
        
        return {
            'best_frame': {
                'timestamp': best_frame.timestamp,
                'frame_index': best_frame.frame_index,
                'scores': {
                    'overall': best_frame.overall_score,
                    'emotion': best_frame.emotion_score,
                    'readability': best_frame.text_readability_score,
                    'composition': best_frame.composition_score,
                    'ssim': best_frame.ssim_score
                }
            },
            'thumbnail_data': thumbnail_data,
            'alternatives': [
                {
                    'timestamp': alt.timestamp,
                    'score': alt.overall_score
                } for alt in alternatives
            ]
        }
    
    async def _extract_frame_candidates(self, video_path: str) -> List[FrameCandidate]:
        """Extract candidate frames from video"""
        candidates = []
        
        cap = cv2.VideoCapture(video_path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Calculate frame indices to sample
        frames_to_analyze = min(self.frame_analysis_window * fps, total_frames)
        frame_interval = max(1, fps // self.candidates_per_second)
        
        prev_frame = None
        
        for i in range(0, frames_to_analyze, frame_interval):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            
            if not ret:
                continue
            
            timestamp = i / fps
            
            # Calculate SSIM to detect scene changes
            ssim_score = 1.0
            if prev_frame is not None:
                ssim_score = self._calculate_ssim(prev_frame, frame)
            
            # Detect faces
            face_count = self._detect_faces(frame)
            
            candidate = FrameCandidate(
                timestamp=timestamp,
                frame_index=i,
                ssim_score=ssim_score,
                face_count=face_count,
                emotion_score=0.0,
                text_readability_score=0.0,
                composition_score=0.0,
                overall_score=0.0,
                frame_data=frame
            )
            
            candidates.append(candidate)
            prev_frame = frame
        
        cap.release()
        
        # Filter candidates with significant scene changes
        filtered_candidates = []
        for i, candidate in enumerate(candidates):
            if i == 0 or candidate.ssim_score < 0.9:  # Scene change threshold
                filtered_candidates.append(candidate)
        
        return filtered_candidates[:15]  # Limit to top 15 candidates
    
    def _calculate_ssim(self, frame1: np.ndarray, frame2: np.ndarray) -> float:
        """Calculate structural similarity between frames"""
        gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)
        
        # Resize to speed up computation
        gray1 = cv2.resize(gray1, (320, 180))
        gray2 = cv2.resize(gray2, (320, 180))
        
        score, _ = ssim(gray1, gray2, full=True)
        return score
    
    def _detect_faces(self, frame: np.ndarray) -> int:
        """Detect number of faces in frame"""
        try:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Resize for faster processing
            small_frame = cv2.resize(rgb_frame, (0, 0), fx=0.25, fy=0.25)
            
            # Detect faces
            face_locations = face_recognition.face_locations(small_frame)
            return len(face_locations)
        except Exception as e:
            logger.error(f"Face detection error: {e}")
            return 0
    
    async def _analyze_frame(self, candidate: FrameCandidate, 
                           headline_text: Optional[str] = None) -> Dict[str, float]:
        """Analyze frame for emotion, readability, and composition"""
        scores = {
            'emotion': 0.5,  # Default neutral
            'readability': 0.5,
            'composition': 0.5
        }
        
        # Emotion analysis (if faces detected)
        if candidate.face_count > 0 and self.openai_api_key:
            emotion_score = await self._analyze_emotion_gpt(candidate.frame_data)
            scores['emotion'] = emotion_score
        
        # Text readability (if headline provided)
        if headline_text:
            readability_score = self._calculate_readability(candidate.frame_data, headline_text)
            scores['readability'] = readability_score
        
        # Composition analysis
        composition_score = self._analyze_composition(candidate.frame_data)
        scores['composition'] = composition_score
        
        return scores
    
    async def _analyze_emotion_gpt(self, frame: np.ndarray) -> float:
        """Use GPT vision to analyze emotion in frame"""
        try:
            # Convert frame to base64
            _, buffer = cv2.imencode('.jpg', frame)
            image_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Call GPT-4 vision API (simulated for now)
            # In production, use actual OpenAI API
            
            # Simulate emotion scores
            emotions = {
                'joy': 0.9,
                'surprise': 0.85,
                'curiosity': 0.8,
                'neutral': 0.5,
                'sad': 0.3
            }
            
            # Return highest emotion score
            return max(emotions.values())
            
        except Exception as e:
            logger.error(f"Emotion analysis error: {e}")
            return 0.5
    
    def _calculate_readability(self, frame: np.ndarray, text: str) -> float:
        """Calculate how readable text would be on this frame"""
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate contrast in potential text areas
        h, w = gray.shape
        
        # Text areas (top, middle, bottom thirds)
        regions = [
            gray[0:h//3, :],  # Top
            gray[h//3:2*h//3, :],  # Middle
            gray[2*h//3:, :]  # Bottom
        ]
        
        max_contrast = 0
        for region in regions:
            # Calculate standard deviation as proxy for contrast
            contrast = np.std(region) / 255.0
            max_contrast = max(max_contrast, contrast)
        
        # Higher contrast = better readability
        readability = 1.0 - max_contrast  # Invert so uniform areas score higher
        
        return min(1.0, max(0.0, readability))
    
    def _analyze_composition(self, frame: np.ndarray) -> float:
        """Analyze frame composition using rule of thirds"""
        h, w, _ = frame.shape
        
        # Convert to grayscale for edge detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect edges
        edges = cv2.Canny(gray, 50, 150)
        
        # Rule of thirds grid
        third_w = w // 3
        third_h = h // 3
        
        # Check edge density at intersection points
        intersection_scores = []
        
        for i in [1, 2]:
            for j in [1, 2]:
                x = i * third_w
                y = j * third_h
                
                # Sample region around intersection
                region = edges[max(0, y-20):min(h, y+20), 
                              max(0, x-20):min(w, x+20)]
                
                # Calculate edge density
                density = np.sum(region > 0) / region.size
                intersection_scores.append(density)
        
        # Average intersection scores
        composition_score = np.mean(intersection_scores)
        
        # Normalize to 0-1 range
        return min(1.0, composition_score * 5)
    
    def _calculate_overall_score(self, scores: Dict[str, float]) -> float:
        """Calculate weighted overall score"""
        weights = {
            'emotion': 0.4,
            'readability': 0.3,
            'composition': 0.3
        }
        
        overall = sum(scores[key] * weights[key] for key in weights)
        return overall
    
    async def _generate_thumbnail(self, candidate: FrameCandidate, 
                                headline_text: Optional[str] = None) -> Dict[str, Any]:
        """Generate thumbnail from selected frame"""
        frame = candidate.frame_data
        
        # Add headline text if provided
        if headline_text:
            frame = self._add_text_overlay(frame, headline_text)
        
        # Convert to different sizes
        sizes = {
            'standard': (1280, 720),
            'square': (1080, 1080),
            'vertical': (1080, 1920)
        }
        
        thumbnails = {}
        for size_name, dimensions in sizes.items():
            resized = self._resize_and_crop(frame, dimensions)
            
            # Encode to base64
            _, buffer = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, 95])
            thumbnails[size_name] = base64.b64encode(buffer).decode('utf-8')
        
        return {
            'thumbnails': thumbnails,
            'timestamp': candidate.timestamp,
            'metadata': {
                'has_text': headline_text is not None,
                'face_count': candidate.face_count,
                'scores': {
                    'emotion': candidate.emotion_score,
                    'readability': candidate.text_readability_score,
                    'composition': candidate.composition_score
                }
            }
        }
    
    def _add_text_overlay(self, frame: np.ndarray, text: str) -> np.ndarray:
        """Add text overlay to frame"""
        frame_copy = frame.copy()
        h, w, _ = frame_copy.shape
        
        # Text properties
        font = cv2.FONT_HERSHEY_BOLD
        font_scale = w / 400  # Scale based on width
        thickness = max(2, int(font_scale * 2))
        
        # Calculate text size
        (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, thickness)
        
        # Position text in upper third
        x = (w - text_w) // 2
        y = h // 3
        
        # Add background rectangle for readability
        padding = 20
        cv2.rectangle(frame_copy, 
                     (x - padding, y - text_h - padding),
                     (x + text_w + padding, y + padding),
                     (0, 0, 0), -1)
        
        # Add text
        cv2.putText(frame_copy, text, (x, y), font, font_scale, 
                   (255, 255, 255), thickness, cv2.LINE_AA)
        
        return frame_copy
    
    def _resize_and_crop(self, frame: np.ndarray, target_size: Tuple[int, int]) -> np.ndarray:
        """Resize and center crop frame to target size"""
        h, w, _ = frame.shape
        target_w, target_h = target_size
        
        # Calculate scaling factor
        scale = max(target_w / w, target_h / h)
        
        # Resize
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        
        # Center crop
        start_x = (new_w - target_w) // 2
        start_y = (new_h - target_h) // 2
        
        cropped = resized[start_y:start_y + target_h, start_x:start_x + target_w]
        
        return cropped

# Integration function for Visual-Composer agent
async def enhance_visual_composer_with_cover_selection(video_path: str,
                                                      content_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Enhance visual composer with cover frame selection"""
    
    selector = CoverFrameSelector()
    
    # Extract headline from metadata
    headline = content_metadata.get('hook_text', '')
    if len(headline) > 40:
        headline = headline[:37] + "..."
    
    # Select cover frame
    result = await selector.select_cover_frame(video_path, headline)
    
    # Update metadata with cover frame info
    enhanced_metadata = content_metadata.copy()
    enhanced_metadata['cover_frame'] = result['best_frame']
    enhanced_metadata['thumbnail_urls'] = result['thumbnail_data']['thumbnails']
    enhanced_metadata['thumbnail_alternatives'] = result['alternatives']
    
    return enhanced_metadata