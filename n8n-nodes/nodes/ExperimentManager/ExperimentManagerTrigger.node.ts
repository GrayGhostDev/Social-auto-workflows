import {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';

export class ExperimentManagerTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Experiment Manager Trigger',
		name: 'experimentManagerTrigger',
		icon: 'file:experiment.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts workflow when experiment events occur',
		defaults: {
			name: 'Experiment Manager Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'experimentManagerApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'experiment-manager',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Experiment Started',
						value: 'experiment_started',
						description: 'Triggers when a new experiment begins',
					},
					{
						name: 'Experiment Completed',
						value: 'experiment_completed',
						description: 'Triggers when an experiment finishes',
					},
					{
						name: 'Winner Declared',
						value: 'winner_declared',
						description: 'Triggers when a winning variant is identified',
					},
					{
						name: 'Significant Result',
						value: 'significant_result',
						description: 'Triggers when statistical significance is reached',
					},
					{
						name: 'Variant Performance Update',
						value: 'variant_update',
						description: 'Triggers on variant performance updates',
					},
					{
						name: 'Experiment Failed',
						value: 'experiment_failed',
						description: 'Triggers when an experiment encounters errors',
					},
				],
				default: 'experiment_completed',
				description: 'The event to listen for',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'Content Type',
						name: 'contentType',
						type: 'multiOptions',
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
						default: [],
						description: 'Filter by content types',
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
						default: [],
						description: 'Filter by success metrics',
					},
					{
						displayName: 'Minimum Confidence',
						name: 'minConfidence',
						type: 'number',
						default: 0.95,
						description: 'Minimum confidence threshold (0-1)',
						typeOptions: {
							minValue: 0.8,
							maxValue: 0.99,
							numberPrecision: 2,
						},
					},
					{
						displayName: 'Experiment Status',
						name: 'experimentStatus',
						type: 'multiOptions',
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
						default: [],
						description: 'Filter by experiment status',
					},
					{
						displayName: 'Minimum Sample Size',
						name: 'minSampleSize',
						type: 'number',
						default: 100,
						description: 'Minimum sample size per variant',
						typeOptions: {
							minValue: 10,
							maxValue: 10000,
						},
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Raw Data',
						name: 'includeRawData',
						type: 'boolean',
						default: false,
						description: 'Whether to include raw experiment data',
					},
					{
						displayName: 'Include Analytics',
						name: 'includeAnalytics',
						type: 'boolean',
						default: true,
						description: 'Whether to include detailed analytics',
					},
					{
						displayName: 'Real-time Updates',
						name: 'realTimeUpdates',
						type: 'boolean',
						default: true,
						description: 'Whether to receive real-time updates',
					},
					{
						displayName: 'Update Interval',
						name: 'updateInterval',
						type: 'number',
						default: 300,
						displayOptions: {
							show: {
								realTimeUpdates: [true],
							},
						},
						description: 'Update interval in seconds',
						typeOptions: {
							minValue: 60,
							maxValue: 3600,
						},
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const credentials = await this.getCredentials('experimentManagerApi');
				const baseUrl = credentials.baseUrl as string;

				try {
					const response = await this.helpers.request({
						method: 'GET',
						uri: `${baseUrl}/webhooks`,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});

					const existingWebhook = response.webhooks?.find(
						(webhook: any) => webhook.url === webhookUrl
					);

					return !!existingWebhook;
				} catch (error) {
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const event = this.getNodeParameter('event') as string;
				const filters = this.getNodeParameter('filters') as IDataObject;
				const options = this.getNodeParameter('options') as IDataObject;
				const credentials = await this.getCredentials('experimentManagerApi');
				const baseUrl = credentials.baseUrl as string;

				const body = {
					url: webhookUrl,
					event,
					filters,
					options,
					active: true,
				};

				try {
					await this.helpers.request({
						method: 'POST',
						uri: `${baseUrl}/webhooks`,
						body,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});
				} catch (error) {
					return false;
				}

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const credentials = await this.getCredentials('experimentManagerApi');
				const baseUrl = credentials.baseUrl as string;

				try {
					// First get the webhook ID
					const response = await this.helpers.request({
						method: 'GET',
						uri: `${baseUrl}/webhooks`,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});

					const webhook = response.webhooks?.find(
						(wh: any) => wh.url === webhookUrl
					);

					if (webhook) {
						await this.helpers.request({
							method: 'DELETE',
							uri: `${baseUrl}/webhooks/${webhook.id}`,
							json: true,
							headers: {
								Authorization: `Bearer ${credentials.apiKey}`,
							},
						});
					}
				} catch (error) {
					return false;
				}

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData() as IDataObject;
		const event = this.getNodeParameter('event') as string;
		const filters = this.getNodeParameter('filters') as IDataObject;

		// Validate event type
		if (bodyData.event !== event) {
			return {
				workflowData: [[]],
			};
		}

		// Apply filters
		if (filters.contentType && Array.isArray(filters.contentType) && filters.contentType.length > 0) {
			const contentType = bodyData.content_type as string;
			if (!filters.contentType.includes(contentType)) {
				return {
					workflowData: [[]],
				};
			}
		}

		if (filters.minConfidence && bodyData.confidence) {
			const confidence = bodyData.confidence as number;
			if (confidence < (filters.minConfidence as number)) {
				return {
					workflowData: [[]],
				};
			}
		}

		if (filters.experimentStatus && Array.isArray(filters.experimentStatus) && filters.experimentStatus.length > 0) {
			const status = bodyData.status as string;
			if (!filters.experimentStatus.includes(status)) {
				return {
					workflowData: [[]],
				};
			}
		}

		if (filters.minSampleSize && bodyData.sample_size) {
			const sampleSize = bodyData.sample_size as number;
			if (sampleSize < (filters.minSampleSize as number)) {
				return {
					workflowData: [[]],
				};
			}
		}

		// Return the data to the workflow
		return {
			workflowData: [
				[
					{
						json: bodyData,
						headers: this.getHeaderData(),
						query: this.getQueryData(),
					},
				],
			],
		};
	}
}