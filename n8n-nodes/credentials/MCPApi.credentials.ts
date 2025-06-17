import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MCPApi implements ICredentialType {
	name = 'mcpApi';
	displayName = 'MCP API';
	documentationUrl = 'https://docs.grayghostai.com/integrations/mcp';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'API key for MCP Bridge authentication',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://mcp-bridge.mcp:3000',
			required: true,
			description: 'Base URL of the MCP Bridge service',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Production',
					value: 'production',
				},
				{
					name: 'Staging',
					value: 'staging',
				},
				{
					name: 'Development',
					value: 'development',
				},
			],
			default: 'production',
			description: 'Environment for the MCP Bridge',
		},
		{
			displayName: 'Additional Options',
			name: 'additionalOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			options: [
				{
					displayName: 'Request Timeout',
					name: 'requestTimeout',
					type: 'number',
					default: 30000,
					description: 'Default request timeout in milliseconds',
					typeOptions: {
						minValue: 1000,
						maxValue: 300000,
					},
				},
				{
					displayName: 'Enable Metrics',
					name: 'enableMetrics',
					type: 'boolean',
					default: false,
					description: 'Whether to collect performance metrics',
				},
				{
					displayName: 'Custom Headers',
					name: 'customHeaders',
					type: 'json',
					default: '{}',
					description: 'Additional headers to send with each request',
				},
			],
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				'X-MCP-Environment': '={{$credentials.environment}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/health',
		},
	};
}