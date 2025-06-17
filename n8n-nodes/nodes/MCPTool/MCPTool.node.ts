import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class MCPTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MCP Tool',
		name: 'mcpTool',
		icon: 'file:mcp.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["server"] + ": " + $parameter["tool"]}}',
		description: 'Execute tools from Model Context Protocol (MCP) servers',
		defaults: {
			name: 'MCP Tool',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'mcpApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'MCP Server',
				name: 'server',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getServers',
				},
				default: '',
				required: true,
				description: 'The MCP server to connect to',
			},
			{
				displayName: 'Tool',
				name: 'tool',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getTools',
					loadOptionsDependsOn: ['server'],
				},
				default: '',
				required: true,
				description: 'The tool to execute',
			},
			{
				displayName: 'Parameters',
				name: 'parameters',
				type: 'json',
				default: '{}',
				required: true,
				description: 'Tool parameters as JSON',
				displayOptions: {
					show: {
						tool: [
							{ _cnd: { not: '' } },
						],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Timeout in milliseconds',
						typeOptions: {
							minValue: 1000,
							maxValue: 300000,
						},
					},
					{
						displayName: 'Retry on Failure',
						name: 'retryOnFailure',
						type: 'boolean',
						default: true,
						description: 'Whether to retry if the tool execution fails',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						default: 3,
						displayOptions: {
							show: {
								retryOnFailure: [true],
							},
						},
						typeOptions: {
							minValue: 1,
							maxValue: 10,
						},
					},
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: false,
						description: 'Whether to include execution metadata in the output',
					},
					{
						displayName: 'Raw Output',
						name: 'rawOutput',
						type: 'boolean',
						default: false,
						description: 'Whether to return raw MCP response without processing',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getServers(this: IExecuteFunctions) {
				const credentials = await this.getCredentials('mcpApi');
				const baseUrl = credentials.baseUrl as string;

				try {
					const response = await this.helpers.request({
						method: 'GET',
						uri: `${baseUrl}/servers`,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});

					return response.servers.map((server: any) => ({
						name: server.name,
						value: server.id,
						description: server.description,
					}));
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load MCP servers: ${error.message}`,
					);
				}
			},

			async getTools(this: IExecuteFunctions) {
				const credentials = await this.getCredentials('mcpApi');
				const baseUrl = credentials.baseUrl as string;
				const server = this.getCurrentNodeParameter('server') as string;

				if (!server) {
					return [];
				}

				try {
					const response = await this.helpers.request({
						method: 'GET',
						uri: `${baseUrl}/servers/${server}/tools`,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});

					return response.tools.map((tool: any) => ({
						name: tool.name,
						value: tool.name,
						description: tool.description,
					}));
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load tools: ${error.message}`,
					);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('mcpApi');
		const baseUrl = credentials.baseUrl as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const server = this.getNodeParameter('server', i) as string;
				const tool = this.getNodeParameter('tool', i) as string;
				const parameters = this.getNodeParameter('parameters', i) as string;
				const options = this.getNodeParameter('options', i) as any;

				// Parse parameters
				let parsedParams: any;
				try {
					parsedParams = JSON.parse(parameters);
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid JSON in parameters',
						{ itemIndex: i },
					);
				}

				// Prepare request body
				const body = {
					server,
					tool,
					parameters: parsedParams,
					options: {
						timeout: options.timeout || 30000,
						includeMetadata: options.includeMetadata || false,
					},
				};

				// Execute tool with retry logic
				let response: any;
				let retries = 0;
				const maxRetries = options.retryOnFailure ? (options.maxRetries || 3) : 0;

				while (retries <= maxRetries) {
					try {
						response = await this.helpers.request({
							method: 'POST',
							uri: `${baseUrl}/execute`,
							body,
							json: true,
							headers: {
								Authorization: `Bearer ${credentials.apiKey}`,
							},
							timeout: options.timeout || 30000,
						});
						break;
					} catch (error) {
						if (retries === maxRetries) {
							throw error;
						}
						retries++;
						// Exponential backoff
						await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
					}
				}

				// Process response
				if (options.rawOutput) {
					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				} else {
					// Extract result and metadata
					const result = {
						result: response.result,
						...(options.includeMetadata && {
							metadata: {
								server: response.server,
								tool: response.tool,
								executionTime: response.executionTime,
								timestamp: response.timestamp,
							},
						}),
					};

					returnData.push({
						json: result,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							server: this.getNodeParameter('server', i),
							tool: this.getNodeParameter('tool', i),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(
					this.getNode(),
					`MCP Tool execution failed: ${error.message}`,
					{ itemIndex: i },
				);
			}
		}

		return [returnData];
	}
}