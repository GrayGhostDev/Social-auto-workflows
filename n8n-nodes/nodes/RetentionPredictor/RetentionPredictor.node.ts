import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class RetentionPredictor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Retention Predictor',
		name: 'retentionPredictor',
		icon: 'file:retention.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Predict and optimize content retention using ML models',
		defaults: {
			name: 'Retention Predictor',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'retentionPredictorApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Prediction',
						value: 'prediction',
					},
					{
						name: 'Optimization',
						value: 'optimization',
					},
					{
						name: 'Analysis',
						value: 'analysis',
					},
					{
						name: 'Model',
						value: 'model',
					},
				],
				default: 'prediction',
			},
			// Prediction Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['prediction'],
					},
				},
				options: [
					{
						name: 'Predict',
						value: 'predict',
						description: 'Predict retention for content',
						action: 'Predict retention',
					},
					{
						name: 'Batch Predict',
						value: 'batchPredict',
						description: 'Predict retention for multiple content items',
						action: 'Batch predict retention',
					},
					{
						name: 'Real-time Score',
						value: 'realtimeScore',
						description: 'Get real-time retention score',
						action: 'Get real-time score',
					},
				],
				default: 'predict',
			},
			// Optimization Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['optimization'],
					},
				},
				options: [
					{
						name: 'Optimize Content',
						value: 'optimizeContent',
						description: 'Get optimization suggestions',
						action: 'Optimize content',
					},
					{
						name: 'Find Best Hook',
						value: 'findBestHook',
						description: 'Find optimal opening hook',
						action: 'Find best hook',
					},
					{
						name: 'Suggest Edits',
						value: 'suggestEdits',
						description: 'Suggest edits to improve retention',
						action: 'Suggest edits',
					},
				],
				default: 'optimizeContent',
			},
			// Analysis Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['analysis'],
					},
				},
				options: [
					{
						name: 'Analyze Drop-off',
						value: 'analyzeDropoff',
						description: 'Analyze retention drop-off points',
						action: 'Analyze drop-off',
					},
					{
						name: 'Compare Performance',
						value: 'comparePerformance',
						description: 'Compare retention across content',
						action: 'Compare performance',
					},
					{
						name: 'Segment Analysis',
						value: 'segmentAnalysis',
						description: 'Analyze retention by audience segment',
						action: 'Analyze segments',
					},
				],
				default: 'analyzeDropoff',
			},
			// Model Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['model'],
					},
				},
				options: [
					{
						name: 'Get Info',
						value: 'getInfo',
						description: 'Get model information',
						action: 'Get model info',
					},
					{
						name: 'Update Model',
						value: 'updateModel',
						description: 'Update ML model with new data',
						action: 'Update model',
					},
					{
						name: 'Get Metrics',
						value: 'getMetrics',
						description: 'Get model performance metrics',
						action: 'Get model metrics',
					},
				],
				default: 'getInfo',
			},
			// Predict Fields
			{
				displayName: 'Content Data',
				name: 'contentData',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['prediction'],
						operation: ['predict'],
					},
				},
				default: '',
				description: 'Content data to predict retention for',
			},
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['prediction'],
						operation: ['predict', 'batchPredict'],
					},
				},
				options: [
					{
						name: 'Video',
						value: 'video',
					},
					{
						name: 'Short-form Video',
						value: 'short_video',
					},
					{
						name: 'Image Carousel',
						value: 'carousel',
					},
					{
						name: 'Story',
						value: 'story',
					},
					{
						name: 'Live Stream',
						value: 'live',
					},
					{
						name: 'Article',
						value: 'article',
					},
				],
				default: 'video',
				description: 'Type of content',
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['prediction'],
						operation: ['predict', 'batchPredict', 'realtimeScore'],
					},
				},
				options: [
					{
						name: 'TikTok',
						value: 'tiktok',
					},
					{
						name: 'Instagram',
						value: 'instagram',
					},
					{
						name: 'YouTube',
						value: 'youtube',
					},
					{
						name: 'LinkedIn',
						value: 'linkedin',
					},
					{
						name: 'Twitter',
						value: 'twitter',
					},
				],
				default: 'tiktok',
				description: 'Platform to optimize for',
			},
			// Batch Predict Fields
			{
				displayName: 'Content Items',
				name: 'contentItems',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['prediction'],
						operation: ['batchPredict'],
					},
				},
				default: '',
				description: 'Array of content items to predict retention for',
			},
			// Real-time Score Fields
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['prediction'],
						operation: ['realtimeScore'],
					},
				},
				default: '',
				description: 'URL of the video to analyze',
			},
			// Optimize Content Fields
			{
				displayName: 'Content ID',
				name: 'contentId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['optimization'],
						operation: ['optimizeContent', 'suggestEdits'],
					},
				},
				default: '',
				description: 'ID of content to optimize',
			},
			{
				displayName: 'Target Retention',
				name: 'targetRetention',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['optimization'],
						operation: ['optimizeContent'],
					},
				},
				default: 0.7,
				description: 'Target retention rate (0-1)',
				typeOptions: {
					minValue: 0,
					maxValue: 1,
					numberPrecision: 2,
				},
			},
			// Find Best Hook Fields
			{
				displayName: 'Hook Options',
				name: 'hookOptions',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['optimization'],
						operation: ['findBestHook'],
					},
				},
				default: '',
				description: 'Array of hook options to evaluate',
			},
			{
				displayName: 'Audience Profile',
				name: 'audienceProfile',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['optimization'],
						operation: ['findBestHook'],
					},
				},
				default: '',
				description: 'Target audience profile data',
			},
			// Analyze Drop-off Fields
			{
				displayName: 'Analytics Data',
				name: 'analyticsData',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['analyzeDropoff'],
					},
				},
				default: '',
				description: 'Analytics data with timestamps',
			},
			{
				displayName: 'Threshold',
				name: 'threshold',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['analyzeDropoff'],
					},
				},
				default: 0.1,
				description: 'Drop-off threshold to identify',
				typeOptions: {
					minValue: 0.01,
					maxValue: 0.5,
					numberPrecision: 2,
				},
			},
			// Compare Performance Fields
			{
				displayName: 'Content IDs',
				name: 'contentIds',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['comparePerformance'],
					},
				},
				default: '',
				description: 'Comma-separated content IDs to compare',
			},
			{
				displayName: 'Metric',
				name: 'metric',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['comparePerformance'],
					},
				},
				options: [
					{
						name: 'Average Watch Time',
						value: 'avg_watch_time',
					},
					{
						name: 'Completion Rate',
						value: 'completion_rate',
					},
					{
						name: '3-Second Retention',
						value: 'retention_3s',
					},
					{
						name: '30-Second Retention',
						value: 'retention_30s',
					},
					{
						name: 'Engagement Rate',
						value: 'engagement_rate',
					},
				],
				default: 'completion_rate',
				description: 'Metric to compare',
			},
			// Additional Options
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['prediction', 'optimization', 'analysis'],
					},
				},
				options: [
					{
						displayName: 'Include Confidence Score',
						name: 'includeConfidence',
						type: 'boolean',
						default: true,
						description: 'Whether to include confidence scores',
					},
					{
						displayName: 'Detailed Analysis',
						name: 'detailedAnalysis',
						type: 'boolean',
						default: false,
						description: 'Whether to include detailed analysis',
					},
					{
						displayName: 'Historical Data',
						name: 'historicalData',
						type: 'boolean',
						default: false,
						description: 'Whether to include historical comparisons',
					},
					{
						displayName: 'Segment By',
						name: 'segmentBy',
						type: 'multiOptions',
						options: [
							{
								name: 'Age Group',
								value: 'age',
							},
							{
								name: 'Gender',
								value: 'gender',
							},
							{
								name: 'Location',
								value: 'location',
							},
							{
								name: 'Device Type',
								value: 'device',
							},
							{
								name: 'Time of Day',
								value: 'time',
							},
						],
						default: [],
						description: 'Segments to analyze separately',
					},
					{
						displayName: 'Model Version',
						name: 'modelVersion',
						type: 'options',
						options: [
							{
								name: 'Latest',
								value: 'latest',
							},
							{
								name: 'Stable',
								value: 'stable',
							},
							{
								name: 'Beta',
								value: 'beta',
							},
						],
						default: 'stable',
						description: 'ML model version to use',
					},
					{
						displayName: 'Cache Results',
						name: 'cacheResults',
						type: 'boolean',
						default: true,
						description: 'Whether to cache prediction results',
					},
					{
						displayName: 'Webhook URL',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description: 'Webhook URL for async results',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('retentionPredictorApi');

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const baseUrl = credentials.baseUrl as string || 'http://mcp-gateway.mcp:8080/agents/retention-predictor';

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: any;
				const requestBody: any = {
					action: '',
					data: {},
					context: {
						workflow_id: this.getWorkflow().id,
						execution_id: this.getExecutionId(),
					},
				};

				const additionalFields = this.getNodeParameter('additionalFields', i) as any;

				// Handle different operations
				if (resource === 'prediction') {
					switch (operation) {
						case 'predict':
							requestBody.action = 'predict';
							const contentData = this.getNodeParameter('contentData', i) as string;
							requestBody.data = {
								content: typeof contentData === 'string' ? JSON.parse(contentData) : contentData,
								content_type: this.getNodeParameter('contentType', i) as string,
								platform: this.getNodeParameter('platform', i) as string,
							};
							break;

						case 'batchPredict':
							requestBody.action = 'batch_predict';
							const contentItems = this.getNodeParameter('contentItems', i) as string;
							requestBody.data = {
								items: typeof contentItems === 'string' ? JSON.parse(contentItems) : contentItems,
								content_type: this.getNodeParameter('contentType', i) as string,
								platform: this.getNodeParameter('platform', i) as string,
							};
							break;

						case 'realtimeScore':
							requestBody.action = 'realtime_score';
							requestBody.data = {
								video_url: this.getNodeParameter('videoUrl', i) as string,
								platform: this.getNodeParameter('platform', i) as string,
							};
							break;
					}
				} else if (resource === 'optimization') {
					switch (operation) {
						case 'optimizeContent':
							requestBody.action = 'optimize';
							requestBody.data = {
								content_id: this.getNodeParameter('contentId', i) as string,
								target_retention: this.getNodeParameter('targetRetention', i) as number,
							};
							break;

						case 'findBestHook':
							requestBody.action = 'find_best_hook';
							const hookOptions = this.getNodeParameter('hookOptions', i) as string;
							const audienceProfile = this.getNodeParameter('audienceProfile', i) as string;
							requestBody.data = {
								hooks: typeof hookOptions === 'string' ? JSON.parse(hookOptions) : hookOptions,
								audience: typeof audienceProfile === 'string' ? JSON.parse(audienceProfile) : audienceProfile,
							};
							break;

						case 'suggestEdits':
							requestBody.action = 'suggest_edits';
							requestBody.data = {
								content_id: this.getNodeParameter('contentId', i) as string,
							};
							break;
					}
				} else if (resource === 'analysis') {
					switch (operation) {
						case 'analyzeDropoff':
							requestBody.action = 'analyze_dropoff';
							const analyticsData = this.getNodeParameter('analyticsData', i) as string;
							requestBody.data = {
								analytics: typeof analyticsData === 'string' ? JSON.parse(analyticsData) : analyticsData,
								threshold: this.getNodeParameter('threshold', i) as number,
							};
							break;

						case 'comparePerformance':
							requestBody.action = 'compare';
							requestBody.data = {
								content_ids: (this.getNodeParameter('contentIds', i) as string).split(',').map(id => id.trim()),
								metric: this.getNodeParameter('metric', i) as string,
							};
							break;

						case 'segmentAnalysis':
							requestBody.action = 'segment_analysis';
							requestBody.data = {
								content_id: items[i].json.content_id || '',
								segments: additionalFields.segmentBy || ['age', 'device'],
							};
							break;
					}
				} else if (resource === 'model') {
					switch (operation) {
						case 'getInfo':
							requestBody.action = 'model_info';
							break;

						case 'updateModel':
							requestBody.action = 'update_model';
							requestBody.data = {
								training_data: items[i].json.training_data || [],
							};
							break;

						case 'getMetrics':
							requestBody.action = 'model_metrics';
							break;
					}
				}

				// Add additional fields
				if (additionalFields.includeConfidence !== undefined) {
					requestBody.data.include_confidence = additionalFields.includeConfidence;
				}
				if (additionalFields.detailedAnalysis) {
					requestBody.data.detailed_analysis = additionalFields.detailedAnalysis;
				}
				if (additionalFields.historicalData) {
					requestBody.data.include_historical = additionalFields.historicalData;
				}
				if (additionalFields.segmentBy && additionalFields.segmentBy.length > 0) {
					requestBody.data.segments = additionalFields.segmentBy;
				}
				if (additionalFields.modelVersion) {
					requestBody.data.model_version = additionalFields.modelVersion;
				}
				if (additionalFields.cacheResults !== undefined) {
					requestBody.data.cache_results = additionalFields.cacheResults;
				}
				if (additionalFields.webhookUrl) {
					requestBody.data.webhook_url = additionalFields.webhookUrl;
				}

				// Make the request
				const options = {
					method: 'POST',
					uri: baseUrl,
					body: requestBody,
					json: true,
					timeout: 120000, // Longer timeout for ML operations
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
				};

				responseData = await this.helpers.request(options);

				if (responseData.status === 'error') {
					throw new NodeOperationError(
						this.getNode(),
						`Retention Predictor Error: ${responseData.error || 'Unknown error'}`,
						{
							itemIndex: i,
						},
					);
				}

				returnData.push({
					json: responseData.data || responseData,
					pairedItem: {
						item: i,
					},
				});

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}