#!/usr/bin/env python3
"""
Enterprise AI Agent Base Class
Following Anthropic enterprise best practices and n8n integration patterns
"""

import asyncio
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum

import aiohttp
import redis
from opentelemetry import trace, metrics
from opentelemetry.exporter.jaeger import JaegerExporter
from opentelemetry.exporter.prometheus import PrometheusMetricsExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from pydantic import BaseModel, Field, validator
import anthropic
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_retry,
    after_retry
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(trace_id)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Configure OpenTelemetry
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Metrics setup
metrics_exporter = PrometheusMetricsExporter()
reader = PeriodicExportingMetricReader(metrics_exporter, export_interval_millis=15000)
provider = MeterProvider(metric_readers=[reader])
metrics.set_meter_provider(provider)
meter = metrics.get_meter(__name__)

# Create metrics
request_counter = meter.create_counter(
    name="agent_requests_total",
    description="Total number of agent requests",
    unit="requests"
)
error_counter = meter.create_counter(
    name="agent_errors_total",
    description="Total number of agent errors",
    unit="errors"
)
latency_histogram = meter.create_histogram(
    name="agent_request_duration_seconds",
    description="Agent request duration",
    unit="seconds"
)

class AgentStatus(Enum):
    """Agent execution status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"

@dataclass
class AgentContext:
    """Context for agent execution"""
    request_id: str
    trace_id: str
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    environment: str = "production"
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

class AgentRequest(BaseModel):
    """Base request model for agents"""
    action: str
    data: Dict[str, Any]
    context: Optional[Dict[str, Any]] = None
    webhook_url: Optional[str] = None
    timeout_seconds: int = Field(default=300, ge=30, le=3600)
    
    @validator('action')
    def validate_action(cls, v):
        if not v or not v.strip():
            raise ValueError("Action must not be empty")
        return v.strip().lower()

class AgentResponse(BaseModel):
    """Base response model for agents"""
    status: str
    request_id: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    duration_ms: Optional[int] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EnterpriseAgent(ABC):
    """Base class for enterprise AI agents"""
    
    def __init__(self, 
                 agent_id: str,
                 agent_name: str,
                 version: str = "1.0.0"):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.version = version
        
        # Configuration
        self.anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
        self.redis_host = os.getenv('REDIS_HOST', 'redis-cluster.grayghostai')
        self.redis_port = int(os.getenv('REDIS_PORT', '6379'))
        self.redis_password = os.getenv('REDIS_PASSWORD')
        
        # Initialize clients
        self.anthropic_client = None
        if self.anthropic_api_key:
            self.anthropic_client = anthropic.AsyncAnthropic(api_key=self.anthropic_api_key)
        
        self.redis_client = redis.Redis(
            host=self.redis_host,
            port=self.redis_port,
            password=self.redis_password,
            decode_responses=True
        )
        
        # n8n webhook configuration
        self.n8n_webhook_base = os.getenv('N8N_WEBHOOK_BASE', 'http://n8n:5678/webhook')
        
        # Retry configuration
        self.max_retries = int(os.getenv('MAX_RETRIES', '3'))
        self.retry_delay = int(os.getenv('RETRY_DELAY_MS', '1000'))
        
        logger.info(f"Initialized {self.agent_name} agent v{self.version}")
    
    @abstractmethod
    async def process_action(self, action: str, data: Dict[str, Any], 
                           context: AgentContext) -> Dict[str, Any]:
        """Process specific action - must be implemented by subclasses"""
        pass
    
    @abstractmethod
    def get_supported_actions(self) -> List[str]:
        """Return list of supported actions"""
        pass
    
    @tracer.start_as_current_span("process_request")
    async def process(self, request: AgentRequest) -> AgentResponse:
        """Main entry point for processing requests"""
        start_time = time.time()
        request_id = f"{self.agent_id}-{datetime.now().timestamp()}"
        
        # Create context
        context = AgentContext(
            request_id=request_id,
            trace_id=trace.get_current_span().get_span_context().trace_id,
            metadata=request.context or {}
        )
        
        # Add to metrics
        request_counter.add(1, {"agent": self.agent_id, "action": request.action})
        
        try:
            # Validate action
            if request.action not in self.get_supported_actions():
                raise ValueError(f"Unsupported action: {request.action}")
            
            # Store request in Redis for tracking
            await self._store_request(request_id, request, AgentStatus.PROCESSING)
            
            # Process with timeout
            result = await asyncio.wait_for(
                self.process_action(request.action, request.data, context),
                timeout=request.timeout_seconds
            )
            
            # Create response
            response = AgentResponse(
                status="success",
                request_id=request_id,
                data=result,
                duration_ms=int((time.time() - start_time) * 1000)
            )
            
            # Update status
            await self._store_request(request_id, request, AgentStatus.COMPLETED, response)
            
            # Send webhook if configured
            if request.webhook_url:
                await self._send_webhook(request.webhook_url, response)
            
            # Record latency
            latency_histogram.record(
                time.time() - start_time,
                {"agent": self.agent_id, "action": request.action, "status": "success"}
            )
            
            return response
            
        except asyncio.TimeoutError:
            error_msg = f"Request timeout after {request.timeout_seconds} seconds"
            logger.error(error_msg)
            error_counter.add(1, {"agent": self.agent_id, "error": "timeout"})
            
            response = AgentResponse(
                status="error",
                request_id=request_id,
                error=error_msg,
                duration_ms=int((time.time() - start_time) * 1000)
            )
            
            await self._store_request(request_id, request, AgentStatus.FAILED, response)
            return response
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error processing request: {error_msg}", exc_info=True)
            error_counter.add(1, {"agent": self.agent_id, "error": type(e).__name__})
            
            response = AgentResponse(
                status="error",
                request_id=request_id,
                error=error_msg,
                duration_ms=int((time.time() - start_time) * 1000)
            )
            
            await self._store_request(request_id, request, AgentStatus.FAILED, response)
            return response
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(aiohttp.ClientError),
        before=before_retry(lambda retry_state: logger.info(f"Retrying webhook: {retry_state.attempt_number}"))
    )
    async def _send_webhook(self, webhook_url: str, response: AgentResponse):
        """Send response to webhook URL with retries"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                webhook_url,
                json=response.dict(),
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status >= 400:
                    raise aiohttp.ClientError(f"Webhook failed with status {resp.status}")
    
    async def _store_request(self, request_id: str, request: AgentRequest, 
                           status: AgentStatus, response: Optional[AgentResponse] = None):
        """Store request and response in Redis for tracking"""
        key = f"agent:request:{request_id}"
        data = {
            "agent_id": self.agent_id,
            "request": request.dict(),
            "status": status.value,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if response:
            data["response"] = response.dict()
        
        # Store with TTL of 7 days
        self.redis_client.setex(key, 604800, json.dumps(data, default=str))
    
    @tracer.start_as_current_span("call_anthropic")
    async def call_anthropic(self, 
                           system_prompt: str,
                           user_prompt: str,
                           tools: Optional[List[Dict[str, Any]]] = None,
                           temperature: float = 0.7,
                           max_tokens: int = 4096) -> Dict[str, Any]:
        """Call Anthropic API with enterprise best practices"""
        if not self.anthropic_client:
            raise ValueError("Anthropic API key not configured")
        
        # Format prompts with XML tags for better structure
        formatted_prompt = f"""<request>
<context>{system_prompt}</context>
<task>{user_prompt}</task>
</request>"""
        
        try:
            if tools:
                # Use tool-enabled Claude
                response = await self.anthropic_client.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                    tools=tools
                )
            else:
                # Standard message
                response = await self.anthropic_client.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=[{"role": "user", "content": formatted_prompt}]
                )
            
            return self._parse_anthropic_response(response)
            
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise
    
    def _parse_anthropic_response(self, response) -> Dict[str, Any]:
        """Parse Anthropic response and extract structured data"""
        if hasattr(response, 'content') and response.content:
            content = response.content[0]
            
            if hasattr(content, 'text'):
                # Try to extract JSON from response
                text = content.text
                
                # Look for JSON blocks
                if '```json' in text:
                    json_start = text.find('```json') + 7
                    json_end = text.find('```', json_start)
                    json_str = text[json_start:json_end].strip()
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError:
                        pass
                
                # Try to parse as direct JSON
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return {"response": text}
            
            elif hasattr(content, 'tool_use'):
                # Tool use response
                return {
                    "tool": content.tool_use.name,
                    "input": content.tool_use.input
                }
        
        return {"response": str(response)}
    
    def create_n8n_webhook_url(self, workflow_id: str, node_id: str) -> str:
        """Create n8n webhook URL for agent integration"""
        return f"{self.n8n_webhook_base}/{workflow_id}/{node_id}"
    
    async def validate_n8n_connection(self) -> bool:
        """Validate n8n webhook connection"""
        test_url = f"{self.n8n_webhook_base}/test"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(test_url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    return resp.status < 400
        except Exception as e:
            logger.error(f"n8n connection validation failed: {e}")
            return False

class StructuredPromptBuilder:
    """Helper class for building structured prompts following Anthropic best practices"""
    
    @staticmethod
    def build_analysis_prompt(data: Dict[str, Any], analysis_type: str) -> str:
        """Build structured analysis prompt"""
        return f"""<analysis_request>
<type>{analysis_type}</type>
<data>
{json.dumps(data, indent=2)}
</data>
<requirements>
- Provide detailed analysis
- Include confidence scores
- Suggest actionable improvements
- Format response as JSON
</requirements>
</analysis_request>"""
    
    @staticmethod
    def build_generation_prompt(context: Dict[str, Any], output_type: str) -> str:
        """Build structured generation prompt"""
        return f"""<generation_request>
<output_type>{output_type}</output_type>
<context>
{json.dumps(context, indent=2)}
</context>
<constraints>
- Follow brand guidelines
- Optimize for engagement
- Ensure compliance with policies
- Return structured JSON response
</constraints>
</generation_request>"""
    
    @staticmethod
    def build_tool_use_prompt(task: str, available_tools: List[str]) -> str:
        """Build prompt for tool use"""
        return f"""<tool_use_request>
<task>{task}</task>
<available_tools>
{chr(10).join(f"- {tool}" for tool in available_tools)}
</available_tools>
<instructions>
Select and use the appropriate tools to complete the task.
Provide reasoning for tool selection.
</instructions>
</tool_use_request>"""