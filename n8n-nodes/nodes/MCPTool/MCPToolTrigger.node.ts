import {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';

export class MCPToolTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MCP Tool Trigger',
		name: 'mcpToolTrigger',
		icon: 'file:mcp.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts workflow when MCP events occur',
		defaults: {
			name: 'MCP Tool Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'mcpApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'mcp-tool',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Tool Completed',
						value: 'tool_completed',
						description: 'Triggers when a tool execution completes',
					},
					{
						name: 'Tool Failed',
						value: 'tool_failed',
						description: 'Triggers when a tool execution fails',
					},
					{
						name: 'Server Connected',
						value: 'server_connected',
						description: 'Triggers when an MCP server connects',
					},
					{
						name: 'Server Disconnected',
						value: 'server_disconnected',
						description: 'Triggers when an MCP server disconnects',
					},
					{
						name: 'Tool Registered',
						value: 'tool_registered',
						description: 'Triggers when a new tool is registered',
					},
					{
						name: 'Rate Limited',
						value: 'rate_limited',
						description: 'Triggers when rate limit is reached',
					},
				],
				default: 'tool_completed',
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
						displayName: 'MCP Server',
						name: 'server',
						type: 'string',
						default: '',
						description: 'Filter by specific MCP server ID',
					},
					{
						displayName: 'Tool Name',
						name: 'tool',
						type: 'string',
						default: '',
						description: 'Filter by specific tool name',
					},
					{
						displayName: 'Success Only',
						name: 'successOnly',
						type: 'boolean',
						default: true,
						description: 'Whether to trigger only on successful executions',
						displayOptions: {
							show: {
								'/event': ['tool_completed'],
							},
						},
					},
					{
						displayName: 'Error Pattern',
						name: 'errorPattern',
						type: 'string',
						default: '',
						description: 'Regex pattern to match error messages',
						displayOptions: {
							show: {
								'/event': ['tool_failed'],
							},
						},
					},
					{
						displayName: 'Min Execution Time',
						name: 'minExecutionTime',
						type: 'number',
						default: 0,
						description: 'Minimum execution time in milliseconds',
						typeOptions: {
							minValue: 0,
						},
					},
					{
						displayName: 'Max Execution Time',
						name: 'maxExecutionTime',
						type: 'number',
						default: 0,
						description: 'Maximum execution time in milliseconds (0 = no limit)',
						typeOptions: {
							minValue: 0,
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
						displayName: 'Include Request Data',
						name: 'includeRequestData',
						type: 'boolean',
						default: false,
						description: 'Whether to include the original request data',
					},
					{
						displayName: 'Include Server Info',
						name: 'includeServerInfo',
						type: 'boolean',
						default: true,
						description: 'Whether to include MCP server information',
					},
					{
						displayName: 'Include Metrics',
						name: 'includeMetrics',
						type: 'boolean',
						default: false,
						description: 'Whether to include performance metrics',
					},
					{
						displayName: 'Batch Events',
						name: 'batchEvents',
						type: 'boolean',
						default: false,
						description: 'Whether to batch multiple events',
					},
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						default: 10,
						displayOptions: {
							show: {
								batchEvents: [true],
							},
						},
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
					{
						displayName: 'Batch Timeout',
						name: 'batchTimeout',
						type: 'number',
						default: 5000,
						description: 'Batch timeout in milliseconds',
						displayOptions: {
							show: {
								batchEvents: [true],
							},
						},
						typeOptions: {
							minValue: 1000,
							maxValue: 60000,
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
				const credentials = await this.getCredentials('mcpApi');
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
				const credentials = await this.getCredentials('mcpApi');
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
				const credentials = await this.getCredentials('mcpApi');
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
		const options = this.getNodeParameter('options') as IDataObject;

		// Validate event type
		if (bodyData.event !== event) {
			return {
				workflowData: [[]],
			};
		}

		// Apply filters
		if (filters.server && bodyData.server !== filters.server) {
			return {
				workflowData: [[]],
			};
		}

		if (filters.tool && bodyData.tool !== filters.tool) {
			return {
				workflowData: [[]],
			};
		}

		if (filters.successOnly && event === 'tool_completed' && !bodyData.success) {
			return {
				workflowData: [[]],
			};
		}

		if (filters.errorPattern && event === 'tool_failed' && bodyData.error) {
			const regex = new RegExp(filters.errorPattern as string);
			if (!regex.test(bodyData.error as string)) {
				return {
					workflowData: [[]],
				};
			}
		}

		if (filters.minExecutionTime && bodyData.executionTime) {
			const execTime = bodyData.executionTime as number;
			if (execTime < (filters.minExecutionTime as number)) {
				return {
					workflowData: [[]],
				};
			}
		}

		if (filters.maxExecutionTime && bodyData.executionTime) {
			const execTime = bodyData.executionTime as number;
			if (execTime > (filters.maxExecutionTime as number)) {
				return {
					workflowData: [[]],
				};
			}
		}

		// Process batch events
		if (options.batchEvents) {
			// In a real implementation, this would accumulate events
			// For now, we'll just pass through
		}

		// Build output data
		const outputData: any = {
			event: bodyData.event,
			timestamp: bodyData.timestamp || new Date().toISOString(),
		};

		// Add tool execution data
		if (event === 'tool_completed' || event === 'tool_failed') {
			outputData.server = bodyData.server;
			outputData.tool = bodyData.tool;
			outputData.result = bodyData.result;
			outputData.success = bodyData.success;
			outputData.executionTime = bodyData.executionTime;
			
			if (bodyData.error) {
				outputData.error = bodyData.error;
			}

			if (options.includeRequestData && bodyData.request) {
				outputData.request = bodyData.request;
			}
		}

		// Add server info
		if (options.includeServerInfo && bodyData.serverInfo) {
			outputData.serverInfo = bodyData.serverInfo;
		}

		// Add metrics
		if (options.includeMetrics && bodyData.metrics) {
			outputData.metrics = bodyData.metrics;
		}

		// Return the data to the workflow
		return {
			workflowData: [
				[
					{
						json: outputData,
						headers: this.getHeaderData(),
						query: this.getQueryData(),
					},
				],
			],
		};
	}
}