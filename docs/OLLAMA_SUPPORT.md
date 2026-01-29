# Ollama Support

This project now supports running local LLM models via [Ollama](https://ollama.ai/).

## Setup

### 1. Install Ollama

Download and install Ollama from [https://ollama.ai/](https://ollama.ai/)

### 2. Pull a Model

```bash
# Pull a model (e.g., llama3)
ollama pull llama3

# Or pull other models
ollama pull mistral
ollama pull codellama
ollama pull qwen2.5
```

### 3. Configure Environment Variables

In your `.env` file, add or update the following:

```bash
# Set Ollama as the default provider
DEFAULT_LLM_PROVIDER=local

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3
OLLAMA_TIMEOUT=30000
```

### 4. Start the Server

```bash
# Make sure Ollama is running (it usually starts automatically)
# Then start your game server
npm run dev:server
```

## Features

- **JSON Mode**: Ollama provider supports JSON-formatted responses using Ollama's native `format: "json"` parameter
- **System Prompts**: You can provide system prompts to guide the model's behavior
- **Retry Logic**: Automatic retry with exponential backoff on failures
- **High Rate Limits**: Local models have much higher rate limits (1000 RPM by default)
- **Zero Cost**: No API costs for local inference

## Supported Models

Any model available in Ollama can be used. Popular choices include:

- **llama3** - Meta's Llama 3 model
- **mistral** - Mistral AI's model
- **qwen2.5** - Alibaba's Qwen model
- **codellama** - Code-specialized Llama variant
- **gemma** - Google's Gemma model

## Advanced Configuration

You can customize additional settings:

```bash
# Optional: Customize rate limits (defaults shown)
OLLAMA_RATE_LIMIT_RPM=1000
OLLAMA_RATE_LIMIT_TPM=1000000

# Optional: Customize model parameters
OLLAMA_MAX_TOKENS=4000
OLLAMA_TEMPERATURE=0.7
```

## Switching Between Providers

You can easily switch between cloud and local providers by changing the `DEFAULT_LLM_PROVIDER`:

```bash
# Use Ollama (local)
DEFAULT_LLM_PROVIDER=local

# Use Zhipu AI
DEFAULT_LLM_PROVIDER=zhipu

# Use Gemini
DEFAULT_LLM_PROVIDER=gemini
```

## Troubleshooting

### Ollama Not Responding

1. Check if Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Restart Ollama service if needed

### Model Not Found

Make sure you've pulled the model:
```bash
ollama list  # List installed models
ollama pull <model-name>  # Pull a new model
```

### Slow Responses

- Local inference speed depends on your hardware
- Consider using smaller models (e.g., `llama3:8b` instead of `llama3:70b`)
- Ensure you have sufficient RAM and GPU memory

## Benefits of Local LLM

✅ **Privacy**: All data stays on your machine  
✅ **Cost**: No API fees  
✅ **Availability**: Works offline  
✅ **Customization**: Full control over model selection  
✅ **Speed**: No network latency (depends on hardware)
