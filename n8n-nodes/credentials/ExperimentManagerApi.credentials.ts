import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ExperimentManagerApi implements ICredentialType {
	name = 'experimentManagerApi';
	displayName = 'Experiment Manager API';
	documentationUrl = 'https://docs.grayghostai.com/agents/experiment-manager';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://mcp-gateway.mcp:8080/agents/experiment-manager',
			placeholder: 'http://mcp-gateway.mcp:8080/agents/experiment-manager',
			description: 'The base URL for the Experiment Manager API',
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
			description: 'API key for authenticating with the Experiment Manager agent',
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