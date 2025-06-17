import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class TrendingAudio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Trending Audio',
		name: 'trendingAudio',
		icon: 'file:trending-audio.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Analyze and discover trending audio for social media content',
		defaults: {
			name: 'Trending Audio',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'trendingAudioApi',
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
						name: 'Audio',
						value: 'audio',
					},
					{
						name: 'Analysis',
						value: 'analysis',
					},
					{
						name: 'Trend',
						value: 'trend',
					},
				],
				default: 'audio',
			},
			// Audio Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['audio'],
					},
				},
				options: [
					{
						name: 'Discover',
						value: 'discover',
						description: 'Discover trending audio tracks',
						action: 'Discover audio',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search for specific audio',
						action: 'Search audio',
					},
					{
						name: 'Get Details',
						value: 'getDetails',
						description: 'Get audio track details',
						action: 'Get audio details',
					},
					{
						name: 'Download',
						value: 'download',
						description: 'Download audio for content creation',
						action: 'Download audio',
					},
				],
				default: 'discover',
			},
			// Analysis Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['analysis'],
					},
				},
				options: [
					{
						name: 'Analyze Audio',
						value: 'analyzeAudio',
						description: 'Analyze audio for content suitability',
						action: 'Analyze audio',
					},
					{
						name: 'Match Content',
						value: 'matchContent',
						description: 'Match audio to content type',
						action: 'Match audio to content',
					},
					{
						name: 'Predict Performance',
						value: 'predictPerformance',
						description: 'Predict audio performance',
						action: 'Predict audio performance',
					},
				],
				default: 'analyzeAudio',
			},
			// Trend Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['trend'],
					},
				},
				options: [
					{
						name: 'Get Trending',
						value: 'getTrending',
						description: 'Get currently trending audio',
						action: 'Get trending audio',
					},
					{
						name: 'Track History',
						value: 'trackHistory',
						description: 'Get historical trend data',
						action: 'Track trend history',
					},
					{
						name: 'Forecast',
						value: 'forecast',
						description: 'Forecast upcoming audio trends',
						action: 'Forecast trends',
					},
				],
				default: 'getTrending',
			},
			// Discover Audio Fields
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['audio'],
						operation: ['discover'],
					},
				},
				options: [
					{
						name: 'All Platforms',
						value: 'all',
					},
					{
						name: 'TikTok',
						value: 'tiktok',
					},
					{
						name: 'Instagram Reels',
						value: 'instagram',
					},
					{
						name: 'YouTube Shorts',
						value: 'youtube',
					},
					{
						name: 'Twitter',
						value: 'twitter',
					},
				],
				default: 'all',
				description: 'Platform to discover audio from',
			},
			{
				displayName: 'Genre',
				name: 'genre',
				type: 'multiOptions',
				displayOptions: {
					show: {
						resource: ['audio'],
						operation: ['discover'],
					},
				},
				options: [
					{
						name: 'Pop',
						value: 'pop',
					},
					{
						name: 'Hip Hop',
						value: 'hiphop',
					},
					{
						name: 'Electronic',
						value: 'electronic',
					},
					{
						name: 'Rock',
						value: 'rock',
					},
					{
						name: 'Classical',
						value: 'classical',
					},
					{
						name: 'Sound Effects',
						value: 'sfx',
					},
					{
						name: 'Voiceover',
						value: 'voiceover',
					},
					{
						name: 'Ambient',
						value: 'ambient',
					},
				],
				default: ['pop'],
				description: 'Music genres to include',
			},
			{
				displayName: 'Time Range',
				name: 'timeRange',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['audio'],
						operation: ['discover'],
					},
				},
				options: [
					{
						name: 'Last 24 Hours',
						value: '1d',
					},
					{
						name: 'Last 7 Days',
						value: '7d',
					},
					{
						name: 'Last 30 Days',
						value: '30d',
					},
					{
						name: 'Last 90 Days',
						value: '90d',
					},
				],
				default: '7d',
				description: 'Time range for trending calculation',
			},
			// Search Audio Fields
			{
				displayName: 'Search Query',
				name: 'searchQuery',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['audio'],
						operation: ['search'],
					},
				},
				default: '',
				description: 'Search query for audio',
			},
			{
				displayName: 'Search Type',
				name: 'searchType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['audio'],
						operation: ['search'],
					},
				},
				options: [
					{
						name: 'Track Name',
						value: 'track',
					},
					{
						name: 'Artist',
						value: 'artist',
					},
					{
						name: 'Lyrics',
						value: 'lyrics',
					},
					{
						name: 'Mood/Vibe',
						value: 'mood',
					},
					{
						name: 'Similar To',
						value: 'similar',
					},
				],
				default: 'track',
				description: 'Type of search to perform',
			},
			// Get Details Fields
			{
				displayName: 'Audio ID',
				name: 'audioId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['audio'],
						operation: ['getDetails', 'download'],
					},
				},
				default: '',
				description: 'ID of the audio track',
			},
			// Analyze Audio Fields
			{
				displayName: 'Audio URL',
				name: 'audioUrl',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['analyzeAudio'],
					},
				},
				default: '',
				description: 'URL of the audio to analyze',
			},
			{
				displayName: 'Analysis Type',
				name: 'analysisType',
				type: 'multiOptions',
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['analyzeAudio'],
					},
				},
				options: [
					{
						name: 'Tempo/BPM',
						value: 'tempo',
					},
					{
						name: 'Energy Level',
						value: 'energy',
					},
					{
						name: 'Mood Detection',
						value: 'mood',
					},
					{
						name: 'Key/Scale',
						value: 'key',
					},
					{
						name: 'Vocal Detection',
						value: 'vocal',
					},
					{
						name: 'Copyright Status',
						value: 'copyright',
					},
				],
				default: ['tempo', 'mood'],
				description: 'Types of analysis to perform',
			},
			// Match Content Fields
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['matchContent'],
					},
				},
				options: [
					{
						name: 'Product Demo',
						value: 'product_demo',
					},
					{
						name: 'Tutorial',
						value: 'tutorial',
					},
					{
						name: 'Motivational',
						value: 'motivational',
					},
					{
						name: 'Comedy/Meme',
						value: 'comedy',
					},
					{
						name: 'Fashion/Lifestyle',
						value: 'fashion',
					},
					{
						name: 'Tech Review',
						value: 'tech',
					},
					{
						name: 'Travel',
						value: 'travel',
					},
				],
				default: 'product_demo',
				description: 'Type of content to match audio for',
			},
			{
				displayName: 'Content Mood',
				name: 'contentMood',
				type: 'multiOptions',
				displayOptions: {
					show: {
						resource: ['analysis'],
						operation: ['matchContent'],
					},
				},
				options: [
					{
						name: 'Upbeat',
						value: 'upbeat',
					},
					{
						name: 'Calm',
						value: 'calm',
					},
					{
						name: 'Dramatic',
						value: 'dramatic',
					},
					{
						name: 'Mysterious',
						value: 'mysterious',
					},
					{
						name: 'Energetic',
						value: 'energetic',
					},
					{
						name: 'Professional',
						value: 'professional',
					},
				],
				default: ['upbeat'],
				description: 'Desired mood for the content',
			},
			// Get Trending Fields
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['trend'],
						operation: ['getTrending'],
					},
				},
				options: [
					{
						name: 'Overall',
						value: 'overall',
					},
					{
						name: 'Rising Fast',
						value: 'rising',
					},
					{
						name: 'Viral',
						value: 'viral',
					},
					{
						name: 'Evergreen',
						value: 'evergreen',
					},
					{
						name: 'Seasonal',
						value: 'seasonal',
					},
				],
				default: 'overall',
				description: 'Category of trending audio',
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
						resource: ['audio', 'analysis', 'trend'],
					},
				},
				options: [
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						default: 20,
						description: 'Maximum number of results',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: true,
						description: 'Whether to include detailed metadata',
					},
					{
						displayName: 'Duration Range',
						name: 'durationRange',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: false,
						},
						default: {},
						options: [
							{
								displayName: 'Duration',
								name: 'duration',
								values: [
									{
										displayName: 'Min Duration (seconds)',
										name: 'min',
										type: 'number',
										default: 0,
										description: 'Minimum duration in seconds',
									},
									{
										displayName: 'Max Duration (seconds)',
										name: 'max',
										type: 'number',
										default: 60,
										description: 'Maximum duration in seconds',
									},
								],
							},
						],
					},
					{
						displayName: 'Exclude Copyrighted',
						name: 'excludeCopyrighted',
						type: 'boolean',
						default: true,
						description: 'Whether to exclude copyrighted audio',
					},
					{
						displayName: 'Language',
						name: 'language',
						type: 'options',
						options: [
							{
								name: 'Any',
								value: 'any',
							},
							{
								name: 'English',
								value: 'en',
							},
							{
								name: 'Spanish',
								value: 'es',
							},
							{
								name: 'French',
								value: 'fr',
							},
							{
								name: 'German',
								value: 'de',
							},
							{
								name: 'Japanese',
								value: 'ja',
							},
							{
								name: 'Korean',
								value: 'ko',
							},
							{
								name: 'Instrumental Only',
								value: 'instrumental',
							},
						],
						default: 'any',
						description: 'Language preference for audio',
					},
					{
						displayName: 'Quality',
						name: 'quality',
						type: 'options',
						options: [
							{
								name: 'Standard',
								value: 'standard',
							},
							{
								name: 'High',
								value: 'high',
							},
							{
								name: 'Lossless',
								value: 'lossless',
							},
						],
						default: 'high',
						description: 'Audio quality preference',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('trendingAudioApi');

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const baseUrl = credentials.baseUrl as string || 'http://mcp-gateway.mcp:8080/agents/trending-audio';

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

				const additionalFields = this.getNodeParameter('additionalFields', i) as any;

				// Handle different operations
				if (resource === 'audio') {
					switch (operation) {
						case 'discover':
							requestBody.action = 'discover';
							requestBody.data = {
								platform: this.getNodeParameter('platform', i) as string,
								genres: this.getNodeParameter('genre', i) as string[],
								time_range: this.getNodeParameter('timeRange', i) as string,
							};
							break;

						case 'search':
							requestBody.action = 'search';
							requestBody.data = {
								query: this.getNodeParameter('searchQuery', i) as string,
								search_type: this.getNodeParameter('searchType', i) as string,
							};
							break;

						case 'getDetails':
							requestBody.action = 'get_details';
							requestBody.data = {
								audio_id: this.getNodeParameter('audioId', i) as string,
							};
							break;

						case 'download':
							requestBody.action = 'download';
							requestBody.data = {
								audio_id: this.getNodeParameter('audioId', i) as string,
								quality: additionalFields.quality || 'high',
							};
							break;
					}
				} else if (resource === 'analysis') {
					switch (operation) {
						case 'analyzeAudio':
							requestBody.action = 'analyze';
							requestBody.data = {
								audio_url: this.getNodeParameter('audioUrl', i) as string,
								analysis_types: this.getNodeParameter('analysisType', i) as string[],
							};
							break;

						case 'matchContent':
							requestBody.action = 'match_content';
							requestBody.data = {
								content_type: this.getNodeParameter('contentType', i) as string,
								content_mood: this.getNodeParameter('contentMood', i) as string[],
							};
							break;

						case 'predictPerformance':
							requestBody.action = 'predict_performance';
							requestBody.data = {
								audio_id: items[i].json.audio_id || '',
								platform: items[i].json.platform || 'general',
							};
							break;
					}
				} else if (resource === 'trend') {
					switch (operation) {
						case 'getTrending':
							requestBody.action = 'get_trending';
							requestBody.data = {
								category: this.getNodeParameter('category', i) as string,
							};
							break;

						case 'trackHistory':
							requestBody.action = 'track_history';
							requestBody.data = {
								audio_id: items[i].json.audio_id || '',
								days: items[i].json.days || 30,
							};
							break;

						case 'forecast':
							requestBody.action = 'forecast';
							requestBody.data = {
								horizon_days: items[i].json.horizon_days || 7,
							};
							break;
					}
				}

				// Add additional fields
				if (additionalFields.limit) {
					requestBody.data.limit = additionalFields.limit;
				}
				if (additionalFields.includeMetadata !== undefined) {
					requestBody.data.include_metadata = additionalFields.includeMetadata;
				}
				if (additionalFields.durationRange?.duration) {
					requestBody.data.duration_range = {
						min: additionalFields.durationRange.duration.min,
						max: additionalFields.durationRange.duration.max,
					};
				}
				if (additionalFields.excludeCopyrighted !== undefined) {
					requestBody.data.exclude_copyrighted = additionalFields.excludeCopyrighted;
				}
				if (additionalFields.language) {
					requestBody.data.language = additionalFields.language;
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
						`Trending Audio Error: ${responseData.error || 'Unknown error'}`,
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