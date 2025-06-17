import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RetentionPredictorApi implements ICredentialType {
	name = 'retentionPredictorApi';
	displayName = 'Retention Predictor API';
	documentationUrl = 'https://docs.grayghostai.com/agents/retention-predictor';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://mcp-gateway.mcp:8080/agents/retention-predictor',
			placeholder: 'http://mcp-gateway.mcp:8080/agents/retention-predictor',
			description: 'The base URL for the Retention Predictor API',
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
			description: 'API key for authenticating with the Retention Predictor agent',
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
		{
			displayName: 'Model Version',
			name: 'modelVersion',
			type: 'options',
			options: [
				{
					name: 'Stable',
					value: 'stable',
				},
				{
					name: 'Latest',
					value: 'latest',
				},
				{
					name: 'Beta',
					value: 'beta',
				},
			],
			default: 'stable',
			description: 'Default ML model version to use',
		},
		{
			displayName: 'Enable GPU',
			name: 'enableGpu',
			type: 'boolean',
			default: false,
			description: 'Whether to use GPU-accelerated predictions when available',
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