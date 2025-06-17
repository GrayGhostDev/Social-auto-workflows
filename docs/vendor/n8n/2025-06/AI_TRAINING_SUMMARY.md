# n8n Node Development Training Summary

## Key Concepts for AI Agents

### 1. Node Structure
```typescript
export class MyNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'My Node',
        name: 'myNode',
        group: ['transform'],
        version: 1,
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            // Node parameters
        ]
    };
    
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        // Node logic
    }
}
```

### 2. Resource/Operation Pattern
- Use `resource` parameter for main entity (e.g., 'user', 'post')
- Use `operation` parameter for actions (e.g., 'create', 'get', 'update')
- Show/hide fields based on resource/operation selection

### 3. Credential Types
```typescript
export class MyApiCredentials implements ICredentialType {
    name = 'myApi';
    displayName = 'My API';
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
        }
    ];
}
```

### 4. Error Handling
```typescript
throw new NodeOperationError(
    this.getNode(),
    'Error message',
    { itemIndex: i }
);
```

### 5. Webhook Nodes
- Implement `webhookMethods` for webhook lifecycle
- Use `IWebhookFunctions` for webhook handling
- Support `checkExists`, `create`, `delete` methods

### 6. Best Practices
- Always handle `continueOnFail()` option
- Use `pairedItem` for item tracking
- Implement proper TypeScript types
- Follow n8n naming conventions
- Use `displayOptions` for conditional UI
