import requests


def get_current_weather(latitude, longitude):
    # Format the URL with proper parameter substitution
    url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto"

    try:
        # Make the API call
        response = requests.get(url)

        # Raise an exception for bad status codes
        response.raise_for_status()

        # Return the JSON response
        return response.json()

    except requests.RequestException as e:
        # Handle any errors that occur during the request
        print(f"Error fetching weather data: {e}")
        return None


def execute_python_code(code: str, output_format: str, timeout: int = None):
    """Execute Python code via local API endpoint.

    Args:
        code (str): The Python code to execute
        output_format (str): Output format ('plain', 'rich', or 'json')
        timeout (int, optional): Timeout in seconds for code execution
    """
    url = "http://localhost:8000/api/v1/execute"
    payload = {"code": code, "output_format": output_format, "timeout": timeout}

    try:
        response = requests.post(
            url, json=payload, headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()

    except requests.RequestException as e:
        return {
            "success": False,
            "error": {"type": "ExecutionError", "message": str(e)},
        }
