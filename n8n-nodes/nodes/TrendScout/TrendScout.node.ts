import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class TrendScout implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Trend Scout',
		name: 'trendScout',
		icon: 'file:trendscout.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Discover and analyze trending content opportunities',
		defaults: {
			name: 'Trend Scout',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'trendScoutApi',
				required: true,
			},
		],
		properties: [
			// Resources
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Trend',
						value: 'trend',
					},
					{
						name: 'Brief',
						value: 'brief',
					},
					{
						name: 'Analysis',
						value: 'analysis',
					},
				],
				default: 'trend',
			},
			// Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['trend'],
					},
				},
				options: [
					{
						name: 'Discover',
						value: 'discover',
						description: 'Discover trending topics from multiple sources',
						action: 'Discover trends',
					},
					{
						name: 'Compare',
						value: 'compare',
						description: 'Compare multiple trends to find best opportunity',
						action: 'Compare trends',
					},
					{
						name: 'Predict Virality',
						value: 'predictVirality',
						description: 'Predict viral potential of content idea',
						action: 'Predict virality',
					},
				],
				default: 'discover',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['brief'],
					},
				},
				options: [
					{
						name: 'Generate',
						value: 'generate',
						description: 'Generate content brief from trends',
						action: 'Generate brief',
					},
				],
				default: 'generate',
			},
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
						name: 'Analyze',
						value: 'analyze',
						description: 'Deep analysis of specific trend',
						action: 'Analyze trend',
					},
				],
				default: 'analyze',
			},
			// Fields for Discover Trends
			{
				displayName: 'Categories',
				name: 'categories',
				type: 'multiOptions',
				displayOptions: {
					show: {
						resource: ['trend'],
						operation: ['discover'],
					},
				},
				options: [
					{
						name: 'Security',
						value: 'security',
					},
					{
						name: 'Technology',
						value: 'tech',
					},
					{
						name: 'AI/ML',
						value: 'ai',
					},
					{
						name: 'Cloud',
						value: 'cloud',
					},
					{
						name: 'DevOps',
						value: 'devops',
					},
				],
				default: ['tech'],
				description: 'Categories to search for trends',
			},
			{
				displayName: 'Sources',
				name: 'sources',
				type: 'multiOptions',
				displayOptions: {
					show: {
						resource: ['trend'],
						operation: ['discover'],
					},
				},
				options: [
					{
						name: 'RSS Feeds',
						value: 'rss',
					},
					{
						name: 'Google Trends',
						value: 'google_trends',
					},
					{
						name: 'Social Media',
						value: 'social',
					},
					{
						name: 'News APIs',
						value: 'news',
					},
				],
				default: ['rss', 'google_trends'],
				description: 'Data sources to check for trends',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['trend'],
						operation: ['discover'],
					},
				},
				default: 20,
				description: 'Maximum number of trends to return',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
			},
			// Fields for Analyze Trend
			{
				displayName: 'Trend Data',
				name: 'trendData',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['analyze'],
					},
				},
				default: '',
				required: true,
				description: 'Trend data to analyze',
			},
			// Fields for Generate Brief
			{
				displayName: 'Trends',
				name: 'trends',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['brief'],
						operation: ['generate'],
					},
				},
				default: '',
				required: true,
				description: 'Trends to generate brief from',
			},
			{
				displayName: 'Target Audience',
				name: 'targetAudience',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['brief'],
						operation: ['generate'],
					},
				},
				default: 'IT professionals and security teams',
				description: 'Target audience for the content',
			},
			{
				displayName: 'Platform Priority',
				name: 'platformPriority',
				type: 'multiOptions',
				displayOptions: {
					show: {
						resource: ['brief'],
						operation: ['generate'],
					},
				},
				options: [
					{
						name: 'LinkedIn',
						value: 'linkedin',
					},
					{
						name: 'Twitter',
						value: 'twitter',
					},
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
				],
				default: ['linkedin', 'twitter'],
				description: 'Platforms to prioritize for content',
			},
			// Fields for Compare Trends
			{
				displayName: 'Trends to Compare',
				name: 'trendsToCompare',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['trend'],
						operation: ['compare'],
					},
				},
				default: '',
				required: true,
				description: 'Array of trends to compare',
			},
			// Fields for Predict Virality
			{
				displayName: 'Content Idea',
				name: 'contentIdea',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['trend'],
						operation: ['predictVirality'],
					},
				},
				default: '',
				required: true,
				description: 'Content idea to predict virality for',
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['trend'],
						operation: ['predictVirality'],
					},
				},
				options: [
					{
						name: 'General',
						value: 'general',
					},
					{
						name: 'LinkedIn',
						value: 'linkedin',
					},
					{
						name: 'Twitter',
						value: 'twitter',
					},
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
				],
				default: 'general',
				description: 'Platform to optimize virality prediction for',
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
						resource: ['trend', 'brief', 'analysis'],
					},
				},
				options: [
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 300,
						description: 'Request timeout in seconds',
						typeOptions: {
							minValue: 30,
							maxValue: 600,
						},
					},
					{
						displayName: 'Use Cache',
						name: 'useCache',
						type: 'boolean',
						default: true,
						description: 'Whether to use cached results when available',
					},
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: false,
						description: 'Whether to include additional metadata in response',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('trendScoutApi');

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get base URL from credentials
		const baseUrl = credentials.baseUrl as string || 'http://mcp-gateway.mcp:8080/agents/trend-scout';

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: any;
				const additionalFields = this.getNodeParameter('additionalFields', i) as any;

				// Build request body based on resource and operation
				const requestBody: any = {
					action: `${operation}_${resource}`,
					data: {},
					context: {
						workflow_id: this.getWorkflow().id,
						execution_id: this.getExecutionId(),
						node_name: this.getNode().name,
					},
					timeout_seconds: additionalFields.timeout || 300,
				};

				// Handle different operations
				if (resource === 'trend' && operation === 'discover') {
					requestBody.action = 'discover_trends';
					requestBody.data = {
						categories: this.getNodeParameter('categories', i) as string[],
						sources: this.getNodeParameter('sources', i) as string[],
						limit: this.getNodeParameter('limit', i) as number,
					};
				} else if (resource === 'analysis' && operation === 'analyze') {
					requestBody.action = 'analyze_trend';
					const trendData = this.getNodeParameter('trendData', i) as string;
					requestBody.data = {
						trend: typeof trendData === 'string' ? JSON.parse(trendData) : trendData,
					};
				} else if (resource === 'brief' && operation === 'generate') {
					requestBody.action = 'generate_brief';
					const trends = this.getNodeParameter('trends', i) as string;
					requestBody.data = {
						trends: typeof trends === 'string' ? JSON.parse(trends) : trends,
						target_audience: this.getNodeParameter('targetAudience', i) as string,
						platform_priority: this.getNodeParameter('platformPriority', i) as string[],
					};
				} else if (resource === 'trend' && operation === 'compare') {
					requestBody.action = 'compare_trends';
					const trendsToCompare = this.getNodeParameter('trendsToCompare', i) as string;
					requestBody.data = {
						trends: typeof trendsToCompare === 'string' ? JSON.parse(trendsToCompare) : trendsToCompare,
					};
				} else if (resource === 'trend' && operation === 'predictVirality') {
					requestBody.action = 'predict_virality';
					const contentIdea = this.getNodeParameter('contentIdea', i) as string;
					requestBody.data = {
						content_idea: typeof contentIdea === 'string' ? JSON.parse(contentIdea) : contentIdea,
						platform: this.getNodeParameter('platform', i) as string,
					};
				}

				// Add additional fields
				if (additionalFields.useCache !== undefined) {
					requestBody.data.use_cache = additionalFields.useCache;
				}
				if (additionalFields.includeMetadata) {
					requestBody.data.include_metadata = additionalFields.includeMetadata;
				}

				// Make the request
				const options = {
					method: 'POST',
					uri: baseUrl,
					body: requestBody,
					json: true,
					timeout: (additionalFields.timeout || 300) * 1000,
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
				};

				responseData = await this.helpers.request(options);

				// Check for errors
				if (responseData.status === 'error') {
					throw new NodeOperationError(
						this.getNode(),
						`Trend Scout Error: ${responseData.error || 'Unknown error'}`,
						{
							itemIndex: i,
						},
					);
				}

				// Add the response to return data
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