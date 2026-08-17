from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import models, db
from app.schema.book import BookResponse
from app.core import security
from app.schema.wishlist import WishlistBookItem, WishlistResponse, WishlistToggleRequest
from app.schema.cart import CartItemCreate, CartItemRead, CartRead
from app.schema.order import OrderRead
from app.schema.notification import NotificationRead
from app.database.dep import require_role

router = APIRouter(
    prefix="/api/customer",
    tags=["Customer"]
)


@router.post("/wishlist/wishlistToggle")
def toggle_wishlist_book(
    request: WishlistToggleRequest,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    existing = db.query(models.Wishlist).filter_by(user_id=current_user.id, book_id=request.book_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"in_wishlist": False}

    wishlist_item = models.Wishlist(user_id=current_user.id, book_id=request.book_id)
    db.add(wishlist_item)
    db.commit()
    return {"in_wishlist": True}

@router.get("/wishlist", response_model=WishlistResponse)
def get_wishlist_books(db: Session = Depends(db.get_db), current_user = Depends(require_role("customer"))):
    items = (
        db.query(models.Wishlist)
        .options(joinedload(models.Wishlist.book))  # eager load books
        .filter_by(user_id=current_user.id)
        .all()
    )
    return WishlistResponse(items=items)

@router.delete("/wishlist/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wishlist_book(
    book_id: UUID,
    db: Session = Depends(db.get_db),
    current_user = Depends(require_role("customer")),
):
    wishlist_item = db.query(models.Wishlist).filter_by(user_id=current_user.id, book_id=book_id).first()
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Book not found in wishlist")

    db.delete(wishlist_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/cart/items", response_model=CartItemRead)
def add_to_cart(
    request: CartItemCreate,
    db: Session = Depends(db.get_db),
    current_user = Depends(require_role("customer"))
):

    book = db.query(models.Book).filter(models.Book.id == request.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        cart = models.Cart(user_id=current_user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)

    cart_item = (
        db.query(models.CartItem)
        .filter(models.CartItem.cart_id == cart.id, models.CartItem.book_id == request.book_id)
        .first()
    )

    if cart_item:
        cart_item.quantity += request.quantity
    else:
        cart_item = models.CartItem(
            cart_id=cart.id,
            book_id=request.book_id,
            quantity=request.quantity,
            unit_price_snapshot=book.price  
        )
        db.add(cart_item)

    db.commit()
    db.refresh(cart_item)

    return cart_item


@router.get("/cart", response_model=CartRead)
def get_cart(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        return CartRead(id=None, user_id=current_user.id, items=[])

    return cart


@router.patch("/cart/items/{book_id}", response_model=CartItemRead)
def change_cart_quantity(book_id: UUID, request: dict, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(404, "Cart not found")

    cart_item = (
        db.query(models.CartItem)
        .filter(models.CartItem.cart_id == cart.id, models.CartItem.book_id == book_id)
        .first()
    )
    if not cart_item:
        raise HTTPException(404, "Item not in cart")

    new_quantity = cart_item.quantity + request["quantity_change"]

    if new_quantity < 1:
        db.delete(cart_item)
        db.commit()
        raise HTTPException(status_code=status.HTTP_204_NO_CONTENT, detail="Item removed")
    
    cart_item.quantity = new_quantity
    db.commit()
    db.refresh(cart_item)
    return cart_item


@router.delete("/cart/items/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(book_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(404, "Cart not found")

    cart_item = db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id, models.CartItem.book_id == book_id).first()
    if not cart_item:
        raise HTTPException(404, "Item not in cart")

    db.delete(cart_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/cart/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove_cart_item(book_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):

    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(404, "Cart not found")
    
    cart_item = (db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id, models.CartItem.book_id == book_id).first())
    if not cart_item:
        raise HTTPException(404, "Item not in cart")
    
    db.delete(cart_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.delete("/cart/cartClear", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(404, "Cart not found")
    
    db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/notifications", response_model=List[NotificationRead])
def list_notifications(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(notification_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    n = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == current_user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.post("/notifications/read-all")
def read_all_notifications(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    db.query(models.Notification).filter(models.Notification.user_id == current_user.id, models.Notification.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()
    return {"message": "ok"}


@router.post("/checkout", response_model=OrderRead)
def cart_checkout(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=400, detail="Cart is empty")

    items = (
        db.query(models.CartItem)
        .options(joinedload(models.CartItem.book))
        .filter(models.CartItem.cart_id == cart.id)
        .all()
    )
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = Decimal("0.00")
    for it in items:
        if not it.book:
            raise HTTPException(status_code=400, detail="Book missing in cart")
        if it.book.stock < it.quantity:
            raise HTTPException(status_code=409, detail=f"Insufficient stock for {it.book.title}")
        subtotal += Decimal(str(it.unit_price_snapshot)) * int(it.quantity)

    shipping = Decimal("5.00") if subtotal > 0 else Decimal("0.00")
    tax = (subtotal * Decimal("0.08")).quantize(Decimal("0.01"))
    total = (subtotal + shipping + tax).quantize(Decimal("0.01"))

    order = models.Order(
        user_id=current_user.id,
        status="processing",
        subtotal=subtotal.quantize(Decimal("0.01")),
        shipping=shipping,
        tax=tax,
        total=total,
    )
    db.add(order)
    db.flush()

    for it in items:
        db.add(
            models.OrderItem(
                order_id=order.id,
                book_id=it.book_id,
                title_snapshot=it.book.title,
                unit_price_snapshot=it.unit_price_snapshot,
                quantity=it.quantity,
            )
        )
        it.book.stock = int(it.book.stock) - int(it.quantity)
        db.delete(it)

    db.commit()

    # Customer notification: order placed
    db.add(
        models.Notification(
            user_id=current_user.id,
            title="Order placed",
            body=f"Your order {str(order.id)} has been placed successfully.",
            is_read=False,
        )
    )

    # Admin notification: new order placed (notify all admins)
    admins = db.query(models.User).filter(models.User.role == "admin").all()
    for admin_user in admins:
        db.add(
            models.Notification(
                user_id=admin_user.id,
                title="New order placed",
                body=f"Order {str(order.id)} was placed by {current_user.email}.",
                is_read=False,
            )
        )
    db.commit()

    order_full = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order.id, models.Order.user_id == current_user.id)
        .first()
    )
    return order_full


@router.get("/orders", response_model=List[OrderRead])
def list_orders(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    return (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.user_id == current_user.id)
        .order_by(models.Order.created_at.desc())
        .all()
    )


@router.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id, models.Order.user_id == current_user.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/orders/{order_id}/cancel", response_model=OrderRead)
def cancel_order(order_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id, models.Order.user_id == current_user.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "cancelled":
        return order

    if order.status != "processing":
        raise HTTPException(status_code=409, detail="Only processing orders can be cancelled")

    for item in order.items:
        book = db.query(models.Book).filter(models.Book.id == item.book_id).first()
        if book:
            book.stock = int(book.stock) + int(item.quantity)

    order.status = "cancelled"
    db.add(
        models.Notification(
            user_id=current_user.id,
            title="Order cancelled",
            body=f"Your order {str(order.id)} has been cancelled successfully.",
            is_read=False,
        )
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

