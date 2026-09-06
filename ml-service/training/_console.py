"""Ép stdout/stderr sang UTF-8.

Console Windows mặc định dùng codepage cp1258 và ném UnicodeEncodeError ngay khi gặp chữ
tiếng Việt có dấu — nghĩa là một script chạy đúng vẫn sập ở dòng print đầu tiên. Đặt ở đây
một lần để mọi script huấn luyện gọi, thay vì bắt người chạy phải nhớ đặt PYTHONIOENCODING.
"""

from __future__ import annotations

import sys


def setup() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            # Stdout bị chuyển hướng vào thứ không reconfigure được — bỏ qua, vì mất dấu
            # tiếng Việt trong log vẫn hơn là sập cả lượt huấn luyện.
            pass
