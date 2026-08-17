from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: UUID
    title: str
    body: str | None = None
    is_read: bool
    created_at: datetime

    class Config:
        orm_mode = True