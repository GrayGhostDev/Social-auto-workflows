import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TrendScoutApi implements ICredentialType {
	name = 'trendScoutApi';
	displayName = 'Trend Scout API';
	documentationUrl = 'https://docs.grayghostai.com/agents/trend-scout';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://mcp-gateway.mcp:8080/agents/trend-scout',
			placeholder: 'http://mcp-gateway.mcp:8080/agents/trend-scout',
			description: 'The base URL for the Trend Scout API',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'API key for authenticating with the Trend Scout agent',
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
			description: 'The environment to connect to',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/health',
			method: 'GET',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'healthy',
					message: 'Connection successful!',
				},
			},
		],
	};
}