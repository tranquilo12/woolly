import os
import logging
from openai import OpenAI, AsyncOpenAI, AzureOpenAI, AsyncAzureOpenAI


def get_openai_client(
    async_client: bool = False,
) -> OpenAI | AsyncOpenAI | AzureOpenAI | AsyncAzureOpenAI:
    """
    Factory function to create OpenAI client based on environment variables.
    Prioritizes Azure OpenAI if credentials are present.
    """
    # Check for Azure OpenAI credentials
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")

    if azure_endpoint and azure_key:
        deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-latest")
        logging.info("Using Azure OpenAI endpoint")
        print(f"Using Azure OpenAI endpoint: {azure_endpoint}")

        client_class = AsyncAzureOpenAI if async_client else AzureOpenAI
        return client_class(
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
            api_version="2024-02-15-preview",
            default_model=deployment,
        )

    # Fallback to standard OpenAI
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise ValueError("No OpenAI API key found in environment variables")

    logging.info("Using standard OpenAI endpoint")
    print(f"Using standard OpenAI endpoint: {openai_key}")
    client_class = AsyncOpenAI if async_client else OpenAI
    return client_class(api_key=openai_key)
