import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class ExperimentManager implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Experiment Manager',
		name: 'experimentManager',
		icon: 'file:experiment.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create and manage A/B testing experiments for content optimization',
		defaults: {
			name: 'Experiment Manager',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'experimentManagerApi',
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
						name: 'Experiment',
						value: 'experiment',
					},
					{
						name: 'Variant',
						value: 'variant',
					},
					{
						name: 'Result',
						value: 'result',
					},
				],
				default: 'experiment',
			},
			// Experiment Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['experiment'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new experiment with variants',
						action: 'Create experiment',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get experiment details',
						action: 'Get experiment',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List all experiments',
						action: 'List experiments',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update experiment status',
						action: 'Update experiment',
					},
					{
						name: 'End',
						value: 'end',
						description: 'End experiment and declare winner',
						action: 'End experiment',
					},
				],
				default: 'create',
			},
			// Variant Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['variant'],
					},
				},
				options: [
					{
						name: 'Get Performance',
						value: 'getPerformance',
						description: 'Get variant performance metrics',
						action: 'Get variant performance',
					},
					{
						name: 'Update Metrics',
						value: 'updateMetrics',
						description: 'Update variant metrics',
						action: 'Update variant metrics',
					},
				],
				default: 'getPerformance',
			},
			// Result Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['result'],
					},
				},
				options: [
					{
						name: 'Analyze',
						value: 'analyze',
						description: 'Analyze experiment results',
						action: 'Analyze results',
					},
					{
						name: 'Get Winner',
						value: 'getWinner',
						description: 'Get winning variant',
						action: 'Get winner',
					},
				],
				default: 'analyze',
			},
			// Create Experiment Fields
			{
				displayName: 'Content ID',
				name: 'contentId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['experiment'],
						operation: ['create'],
					},
				},
				default: '',
				description: 'ID of the content to create experiment for',
			},
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['experiment'],
						operation: ['create'],
					},
				},
				options: [
					{
						name: 'Video',
						value: 'video',
					},
					{
						name: 'Image',
						value: 'image',
					},
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'Carousel',
						value: 'carousel',
					},
					{
						name: 'Story',
						value: 'story',
					},
				],
				default: 'video',
				description: 'Type of content',
			},
			{
				displayName: 'Variant Count',
				name: 'variantCount',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['experiment'],
						operation: ['create'],
					},
				},
				default: 3,
				description: 'Number of variants to create (2-4)',
				typeOptions: {
					minValue: 2,
					maxValue: 4,
				},
			},
			{
				displayName: 'Variant Types',
				name: 'variantTypes',
				type: 'multiOptions',
				displayOptions: {
					show: {
						resource: ['experiment'],
						operation: ['create'],
					},
				},
				options: [
					{
						name: 'Hook Text',
						value: 'hook',
					},
					{
						name: 'Thumbnail',
						value: 'thumbnail',
					},
					{
						name: 'Audio Track',
						value: 'audio',
					},
					{
						name: 'Posting Time',
						value: 'timing',
					},
					{
						name: 'Hashtags',
						value: 'hashtags',
					},
					{
						name: 'Caption',
						value: 'caption',
					},
				],
				default: ['hook', 'thumbnail'],
				description: 'Types of variants to create',
			},
			// Get/Update Experiment Fields
			{
				displayName: 'Experiment ID',
				name: 'experimentId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['experiment'],
						operation: ['get', 'update', 'end'],
					},
				},
				default: '',
				description: 'ID of the experiment',
			},
			// List Experiments Fields
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: {
						resource: ['experiment'],
						operation: ['list'],
					},
				},
				options: [
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{
								name: 'Active',
								value: 'active',
							},
							{
								name: 'Completed',
								value: 'completed',
							},
							{
								name: 'Paused',
								value: 'paused',
							},
							{
								name: 'Failed',
								value: 'failed',
							},
						],
						default: 'active',
						description: 'Filter by experiment status',
					},
					{
						displayName: 'Date Range',
						name: 'dateRange',
						type: 'dateRange',
						default: {},
						description: 'Filter by creation date',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						default: 50,
						description: 'Maximum number of experiments to return',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
				],
			},
			// Variant Performance Fields
			{
				displayName: 'Variant ID',
				name: 'variantId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['variant'],
						operation: ['getPerformance', 'updateMetrics'],
					},
				},
				default: '',
				description: 'ID of the variant',
			},
			// Update Metrics Fields
			{
				displayName: 'Metrics',
				name: 'metrics',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: false,
				},
				displayOptions: {
					show: {
						resource: ['variant'],
						operation: ['updateMetrics'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Performance Metrics',
						name: 'performance',
						values: [
							{
								displayName: 'Views',
								name: 'views',
								type: 'number',
								default: 0,
								description: 'Number of views',
							},
							{
								displayName: 'Engagement Rate',
								name: 'engagementRate',
								type: 'number',
								default: 0,
								description: 'Engagement rate (0-1)',
								typeOptions: {
									minValue: 0,
									maxValue: 1,
									numberPrecision: 3,
								},
							},
							{
								displayName: 'Click-Through Rate',
								name: 'ctr',
								type: 'number',
								default: 0,
								description: 'Click-through rate (0-1)',
								typeOptions: {
									minValue: 0,
									maxValue: 1,
									numberPrecision: 3,
								},
							},
							{
								displayName: 'Conversion Rate',
								name: 'conversionRate',
								type: 'number',
								default: 0,
								description: 'Conversion rate (0-1)',
								typeOptions: {
									minValue: 0,
									maxValue: 1,
									numberPrecision: 3,
								},
							},
						],
					},
				],
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
						resource: ['experiment'],
						operation: ['create'],
					},
				},
				options: [
					{
						displayName: 'Test Duration',
						name: 'testDuration',
						type: 'number',
						default: 120,
						description: 'Test duration in minutes',
						typeOptions: {
							minValue: 30,
							maxValue: 1440,
						},
					},
					{
						displayName: 'Success Metrics',
						name: 'successMetrics',
						type: 'multiOptions',
						options: [
							{
								name: 'Engagement Rate',
								value: 'engagement_rate',
							},
							{
								name: 'Completion Rate',
								value: 'completion_rate',
							},
							{
								name: 'Share Rate',
								value: 'share_rate',
							},
							{
								name: 'Click-Through Rate',
								value: 'ctr',
							},
							{
								name: 'Conversion Rate',
								value: 'conversion_rate',
							},
						],
						default: ['engagement_rate'],
						description: 'Metrics to optimize for',
					},
					{
						displayName: 'Minimum Sample Size',
						name: 'minSampleSize',
						type: 'number',
						default: 100,
						description: 'Minimum sample size per variant',
						typeOptions: {
							minValue: 50,
							maxValue: 1000,
						},
					},
					{
						displayName: 'Confidence Threshold',
						name: 'confidenceThreshold',
						type: 'number',
						default: 0.95,
						description: 'Statistical confidence threshold',
						typeOptions: {
							minValue: 0.8,
							maxValue: 0.99,
							numberPrecision: 2,
						},
					},
					{
						displayName: 'Notion Page ID',
						name: 'notionPageId',
						type: 'string',
						default: '',
						description: 'Notion page ID to update with results',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('experimentManagerApi');

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const baseUrl = credentials.baseUrl as string || 'http://mcp-gateway.mcp:8080/agents/experiment-manager';

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

				// Handle different operations
				if (resource === 'experiment') {
					switch (operation) {
						case 'create':
							requestBody.action = 'create';
							requestBody.data = {
								content_data: {
									id: this.getNodeParameter('contentId', i) as string,
									content_type: this.getNodeParameter('contentType', i) as string,
									variant_count: this.getNodeParameter('variantCount', i) as number,
									variant_types: this.getNodeParameter('variantTypes', i) as string[],
								},
							};
							
							const additionalFields = this.getNodeParameter('additionalFields', i) as any;
							if (additionalFields.testDuration) {
								requestBody.data.test_duration_minutes = additionalFields.testDuration;
							}
							if (additionalFields.successMetrics) {
								requestBody.data.success_metrics = additionalFields.successMetrics;
							}
							if (additionalFields.minSampleSize) {
								requestBody.data.minimum_sample_size = additionalFields.minSampleSize;
							}
							if (additionalFields.confidenceThreshold) {
								requestBody.data.confidence_threshold = additionalFields.confidenceThreshold;
							}
							if (additionalFields.notionPageId) {
								requestBody.data.content_data.notion_id = additionalFields.notionPageId;
							}
							break;

						case 'get':
							requestBody.action = 'get_experiment';
							requestBody.data = {
								experiment_id: this.getNodeParameter('experimentId', i) as string,
							};
							break;

						case 'list':
							requestBody.action = 'list_experiments';
							const filters = this.getNodeParameter('filters', i) as any;
							requestBody.data = {
								filters: {
									status: filters.status,
									date_range: filters.dateRange,
									limit: filters.limit || 50,
								},
							};
							break;

						case 'update':
							requestBody.action = 'update_experiment';
							requestBody.data = {
								experiment_id: this.getNodeParameter('experimentId', i) as string,
							};
							break;

						case 'end':
							requestBody.action = 'analyze';
							requestBody.data = {
								experiment_id: this.getNodeParameter('experimentId', i) as string,
							};
							break;
					}
				} else if (resource === 'variant') {
					switch (operation) {
						case 'getPerformance':
							requestBody.action = 'get_variant_performance';
							requestBody.data = {
								variant_id: this.getNodeParameter('variantId', i) as string,
							};
							break;

						case 'updateMetrics':
							requestBody.action = 'update_variant_metrics';
							const metrics = this.getNodeParameter('metrics', i) as any;
							requestBody.data = {
								variant_id: this.getNodeParameter('variantId', i) as string,
								metrics: metrics.performance || {},
							};
							break;
					}
				} else if (resource === 'result') {
					switch (operation) {
						case 'analyze':
							requestBody.action = 'analyze';
							requestBody.data = {
								experiment_id: this.getNodeParameter('experimentId', i) as string,
							};
							break;

						case 'getWinner':
							requestBody.action = 'get_winner';
							requestBody.data = {
								experiment_id: this.getNodeParameter('experimentId', i) as string,
							};
							break;
					}
				}

				// Make the request
				const options = {
					method: 'POST',
					uri: baseUrl,
					body: requestBody,
					json: true,
					timeout: 60000,
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
				};

				responseData = await this.helpers.request(options);

				if (responseData.status === 'error') {
					throw new NodeOperationError(
						this.getNode(),
						`Experiment Manager Error: ${responseData.error || 'Unknown error'}`,
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