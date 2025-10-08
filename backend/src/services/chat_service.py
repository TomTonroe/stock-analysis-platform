from __future__ import annotations

import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session

from database.models import ChatSession, ChatMessage, SentimentAnalysisCache
from config.settings import get_settings


class ChatService:
    def __init__(self, db: Session, llm_client: Any):
        self.db = db
        self.llm_client = llm_client
        self.settings = get_settings()

    def create_session(self, ticker: str, period: str, sentiment_analysis_id: int) -> str:
        """Create new chat session linked to existing sentiment analysis."""
        # Opportunistically clean up expired sessions
        try:
            self.cleanup_expired_sessions()
        except Exception:
            # Cleanup failure shouldn't block session creation
            pass
        session_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=24)

        # Ensure sentiment analysis exists (optional strictness)
        sentiment = (
            self.db.query(SentimentAnalysisCache)
            .filter(SentimentAnalysisCache.id == sentiment_analysis_id)
            .first()
        )

        session = ChatSession(
            session_id=session_id,
            ticker=ticker.upper(),
            period=period,
            sentiment_analysis_id=sentiment.id if sentiment else None,
            expires_at=expires_at,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(session)
        self.db.commit()
        return session_id

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get active chat session (not expired)."""
        return (
            self.db.query(ChatSession)
            .filter(ChatSession.session_id == session_id, ChatSession.expires_at > datetime.utcnow())
            .first()
        )

    def add_message(self, session_id: str, message_type: str, content: str, metadata: Dict[str, Any] | None = None) -> ChatMessage:
        """Add a message to the session and touch updated_at."""
        message = ChatMessage(
            session_id=session_id,
            message_type=message_type,
            content=content,
            created_at=datetime.utcnow(),
            meta=metadata or {},
        )
        self.db.add(message)

        session = self.get_session(session_id)
        if session:
            session.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(message)
        return message

    def get_conversation_history(self, session_id: str, limit: int = 50) -> List[ChatMessage]:
        """Return ordered conversation history (oldest first)."""
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
            .all()
        )

    def cleanup_expired_sessions(self) -> int:
        """Delete expired chat sessions; messages cascade via ORM relationship."""
        now = datetime.utcnow()
        expired = self.db.query(ChatSession).filter(ChatSession.expires_at <= now).all()
        count = len(expired)
        if count:
            for s in expired:
                self.db.delete(s)
            self.db.commit()
        return count

    def process_chat_message(self, session_id: str, user_message: str) -> str:
        """Process a user message and return the assistant response."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Invalid or expired session")

        # Persist user message
        self.add_message(session_id, "user", user_message)

        # Build context + structured messages (pass db for news caching)
        context = self._build_chat_context(session)
        messages = self._build_chat_messages(context, user_message, db=self.db)

        # Call LLM with structured messages
        result = self.llm_client.call(
            task="sentiment_chat",
            model=self.settings.llm_model,
            messages=messages,
            max_tokens=800,
            temperature=0.3,
        )

        response = result.get("output", "I'm sorry, I couldn't process that request.")

        # Persist assistant response
        self.add_message(
            session_id,
            "assistant",
            response,
            {
                "model": result.get("model"),
                "tokens": result.get("usage", {}).get("total_tokens", 0),
                "duration_ms": result.get("duration_ms"),
                "request_id": result.get("request_id"),
            },
        )

        return response

    def _build_chat_context(self, session: ChatSession) -> Dict[str, Any]:
        sentiment = session.sentiment_analysis
        conversation = self.get_conversation_history(session.session_id, 20)
        return {
            "ticker": session.ticker,
            "period": session.period,
            "sentiment_analysis": sentiment.analysis_data if sentiment else {},
            "conversation_history": [
                {"role": m.message_type, "content": m.content} for m in conversation
            ],
        }

    def _build_chat_messages(
        self,
        context: Dict[str, Any],
        user_message: str,
        db: Optional[Session] = None
    ) -> List[Dict[str, str]]:
        """Create OpenAI-compatible message array with system + history + user + news context."""
        sentiment = context.get("sentiment_analysis", {})
        ticker = context.get("ticker")

        # Build base system message
        system_content = (
            "You are a financial analyst AI assistant discussing your previous analysis of "
            f"{ticker}. Provide educational insights, reference prior analysis, maintain a professional tone, "
            "and avoid personalized investment advice.\n\n"
            "ORIGINAL ANALYSIS CONTEXT:\n"
            + json.dumps(sentiment.get("sentiment_analysis", sentiment), indent=2)
        )

        # Fetch and append recent news context using the context builder
        # This ensures proper caching and consistent news fetching across the app
        try:
            from context.context_builder import enrich_with_news, format_news_for_prompt
            from llm.schemas import NewsHeadline

            # Use enrich_with_news to get cached or fresh news (limit to 3 for chat)
            base_context = {"ticker": ticker}
            enriched = enrich_with_news(
                base_context,
                ticker,
                include_company_news=True,
                include_macro_news=False,  # Skip macro news in chat for brevity
                company_limit=3,
                macro_limit=0,
                db=db  # Pass db session for caching
            )

            company_headlines_data = enriched.get("news_context", {}).get("company_headlines", [])

            if company_headlines_data:
                # Convert dicts back to NewsHeadline objects for formatting
                company_headlines = [NewsHeadline(**h) for h in company_headlines_data]
                formatted_news = format_news_for_prompt(company_headlines, max_headlines=3)
                system_content += (
                    "\n\n"
                    "LATEST NEWS CONTEXT (for reference in discussion):\n"
                    + formatted_news
                    + "\n\n"
                    "Note: Use this news context to provide informed answers, but focus on "
                    "educational discussion rather than making specific trading recommendations."
                )
        except Exception as e:
            # News fetch failure shouldn't break chat - log and continue
            import logging
            logging.getLogger(__name__).warning(f"Failed to fetch news for chat ({ticker}): {str(e)}")

        system_msg = {"role": "system", "content": system_content}

        history = context.get("conversation_history", [])[-10:]
        history_msgs = [{"role": h["role"], "content": h["content"]} for h in history]
        user_msg = {"role": "user", "content": user_message}
        return [system_msg, *history_msgs, user_msg]
