from pydantic import BaseModel
from uuid import UUID

class CategoryCreate(BaseModel):
    name: str

class CategoryResponse(BaseModel):
    id: UUID
    name: str

    class Config:
        from_attributes = True 