import requests


def execute_python_code(code: str, output_format: str, timeout: int = None):
    """Execute Python code via local API endpoint.

    Args:
        code (str): The Python code to execute
        output_format (str): Output format ('plain', 'rich', or 'json')
        timeout (int, optional): Timeout in seconds for code execution
    """
    url = "http://localhost:8000/api/v1/execute"
    payload = {"code": code, "output_format": output_format}

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
