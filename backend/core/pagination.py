from rest_framework.pagination import CursorPagination


class DefaultCursorPagination(CursorPagination):
    """Stable cursor pagination (robust to real-time inserts). Views may override `ordering`."""

    ordering = "-id"
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 100
