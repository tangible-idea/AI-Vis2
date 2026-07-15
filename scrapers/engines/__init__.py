from .base import Engine, AnswerResult
from .chatgpt import ChatGPTEngine
from .gemini import GeminiEngine

ENGINES = {
    "chatgpt": ChatGPTEngine,
    "gemini": GeminiEngine,
}


def get_engine(name: str) -> type[Engine]:
    try:
        return ENGINES[name]
    except KeyError:
        raise SystemExit(f"unknown engine '{name}' — choose from {', '.join(ENGINES)}")
