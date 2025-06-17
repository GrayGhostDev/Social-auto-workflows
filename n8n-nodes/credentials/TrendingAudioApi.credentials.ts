import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TrendingAudioApi implements ICredentialType {
	name = 'trendingAudioApi';
	displayName = 'Trending Audio API';
	documentationUrl = 'https://docs.grayghostai.com/agents/trending-audio';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://mcp-gateway.mcp:8080/agents/trending-audio',
			placeholder: 'http://mcp-gateway.mcp:8080/agents/trending-audio',
			description: 'The base URL for the Trending Audio API',
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
			description: 'API key for authenticating with the Trending Audio agent',
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
			displayName: 'Audio Quality',
			name: 'defaultQuality',
			type: 'options',
			options: [
				{
					name: 'Standard (128 kbps)',
					value: 'standard',
				},
				{
					name: 'High (256 kbps)',
					value: 'high',
				},
				{
					name: 'Lossless (FLAC)',
					value: 'lossless',
				},
			],
			default: 'high',
			description: 'Default audio quality for downloads',
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