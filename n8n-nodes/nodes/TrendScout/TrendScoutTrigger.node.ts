import {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';

export class TrendScoutTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Trend Scout Trigger',
		name: 'trendScoutTrigger',
		icon: 'file:trendscout.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts workflow when Trend Scout events occur',
		defaults: {
			name: 'Trend Scout Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'trendScoutApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'trend-scout',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'New High-Priority Trend',
						value: 'high_priority_trend',
						description: 'Triggers when a trend with high relevance score is discovered',
					},
					{
						name: 'Viral Content Opportunity',
						value: 'viral_opportunity',
						description: 'Triggers when content with high viral potential is identified',
					},
					{
						name: 'Brief Generated',
						value: 'brief_generated',
						description: 'Triggers when a new content brief is generated',
					},
					{
						name: 'Trend Analysis Complete',
						value: 'analysis_complete',
						description: 'Triggers when trend analysis is completed',
					},
					{
						name: 'Competitor Activity',
						value: 'competitor_activity',
						description: 'Triggers when competitor trending content is detected',
					},
				],
				default: 'high_priority_trend',
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
						displayName: 'Minimum Relevance Score',
						name: 'minRelevanceScore',
						type: 'number',
						default: 70,
						description: 'Minimum relevance score to trigger (0-100)',
						typeOptions: {
							minValue: 0,
							maxValue: 100,
						},
					},
					{
						displayName: 'Categories',
						name: 'categories',
						type: 'multiOptions',
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
						default: [],
						description: 'Filter by specific categories',
					},
					{
						displayName: 'Platforms',
						name: 'platforms',
						type: 'multiOptions',
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
						default: [],
						description: 'Filter by target platforms',
					},
					{
						displayName: 'Urgency Level',
						name: 'urgencyLevel',
						type: 'options',
						options: [
							{
								name: 'Any',
								value: 'any',
							},
							{
								name: 'High',
								value: 'high',
							},
							{
								name: 'Medium',
								value: 'medium',
							},
							{
								name: 'Low',
								value: 'low',
							},
						],
						default: 'any',
						description: 'Filter by urgency level',
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
						description: 'Whether to include raw trend data in the output',
					},
					{
						displayName: 'Real-time Updates',
						name: 'realTimeUpdates',
						type: 'boolean',
						default: true,
						description: 'Whether to receive real-time updates or batch them',
					},
					{
						displayName: 'Batch Interval',
						name: 'batchInterval',
						type: 'number',
						default: 300,
						displayOptions: {
							show: {
								realTimeUpdates: [false],
							},
						},
						description: 'Interval in seconds to batch events',
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
				const credentials = await this.getCredentials('trendScoutApi');
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
				const credentials = await this.getCredentials('trendScoutApi');
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
				const credentials = await this.getCredentials('trendScoutApi');
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
		if (filters.minRelevanceScore && bodyData.relevance_score) {
			const score = bodyData.relevance_score as number;
			if (score < (filters.minRelevanceScore as number)) {
				return {
					workflowData: [[]],
				};
			}
		}

		if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
			const category = bodyData.category as string;
			if (!filters.categories.includes(category)) {
				return {
					workflowData: [[]],
				};
			}
		}

		if (filters.urgencyLevel && filters.urgencyLevel !== 'any') {
			const urgency = bodyData.urgency_level as string;
			if (urgency !== filters.urgencyLevel) {
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