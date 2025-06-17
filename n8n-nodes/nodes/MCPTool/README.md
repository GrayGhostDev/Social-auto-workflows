# MCP Tool Node for n8n

Execute tools from Model Context Protocol (MCP) servers within your n8n workflows.

## Features

- 🔧 **Dynamic Tool Discovery** - Automatically discover available tools from connected MCP servers
- 🔄 **Retry Logic** - Built-in retry mechanism with exponential backoff
- ⏱️ **Configurable Timeouts** - Set custom timeouts for tool execution
- 📊 **Metadata Support** - Include execution metadata in outputs
- 🔌 **Multiple Server Support** - Connect to multiple MCP servers simultaneously

## Quick Start

1. Add the MCP Tool node to your workflow
2. Configure MCP API credentials
3. Select a server and tool
4. Set parameters and execute

## Configuration

### Credentials

Create MCP API credentials with:
- **API Key**: JWT token for authentication
- **Base URL**: MCP Bridge service URL (e.g., `http://mcp-bridge.mcp:3000`)
- **Environment**: production, staging, or development

### Node Parameters

- **MCP Server**: Select from available MCP servers
- **Tool**: Choose a tool from the selected server
- **Parameters**: JSON object with tool-specific parameters
- **Options**:
  - **Timeout**: Execution timeout in milliseconds (default: 30000)
  - **Retry on Failure**: Enable automatic retries (default: true)
  - **Max Retries**: Maximum retry attempts (default: 3)
  - **Include Metadata**: Add execution metadata to output (default: false)
  - **Raw Output**: Return unprocessed MCP response (default: false)

## Examples

### File System Operation

```json
{
  "server": "filesystem",
  "tool": "read_file",
  "parameters": {
    "path": "/data/config.json"
  }
}
```

### GitHub Issue Creation

```json
{
  "server": "github",
  "tool": "create_issue",
  "parameters": {
    "owner": "myorg",
    "repo": "myrepo",
    "title": "Bug Report",
    "body": "Description of the issue",
    "labels": ["bug", "priority-high"]
  }
}
```

### Database Query

```json
{
  "server": "postgres",
  "tool": "query",
  "parameters": {
    "query": "SELECT * FROM users WHERE active = true",
    "database": "production"
  }
}
```

## Output Format

### Standard Output
```json
{
  "result": "Tool execution result"
}
```

### With Metadata
```json
{
  "result": "Tool execution result",
  "metadata": {
    "server": "github",
    "tool": "create_issue",
    "executionTime": 1250,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Output
```json
{
  "error": "Error message",
  "server": "github",
  "tool": "create_issue"
}
```

## Error Handling

The node supports `continueOnFail` mode. When enabled:
- Workflow continues even if tool execution fails
- Error information is included in the output
- Failed items are marked but don't stop the workflow

## Performance Tips

1. **Set appropriate timeouts** - Adjust based on expected execution time
2. **Use retry logic wisely** - Enable for transient failures only
3. **Batch operations** - Process multiple items in parallel when possible
4. **Cache results** - Use n8n's caching nodes for repeated operations

## Troubleshooting

### Common Issues

1. **"Server not found"** - Verify the MCP server is connected in the Bridge
2. **"Tool not found"** - Ensure the tool exists on the selected server
3. **"Authentication failed"** - Check API key and permissions
4. **"Timeout exceeded"** - Increase timeout value or optimize tool parameters

### Debug Information

Enable raw output to see complete MCP responses for debugging.

## Supported MCP Servers

- **Filesystem** - File and directory operations
- **GitHub** - Repository and issue management
- **PostgreSQL** - Database queries and operations
- **Web Browser** - Browser automation with Puppeteer
- **Slack** - Workspace and channel management
- **Custom** - Any MCP-compatible server

## Related Nodes

- **MCP Tool Trigger** - Start workflows based on MCP events
- **Function** - Process MCP tool outputs
- **IF** - Conditional logic based on tool results

## Support

- Documentation: https://docs.grayghostai.com/nodes/mcp-tool
- Issues: https://github.com/ggdc/n8n-nodes-grayghostai/issues