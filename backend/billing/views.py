import hmac

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services


class RevenueCatWebhookView(APIView):
    """Store events forwarded by RevenueCat (purchase, renewal, cancellation, expiry...).

    Authenticated by the shared secret set in RevenueCat's webhook settings
    (Authorization header), compared in constant time. Never trusted otherwise.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(exclude=True)
    def post(self, request: Request) -> Response:
        secret = settings.REVENUECAT_WEBHOOK_AUTH
        given = request.headers.get("Authorization", "")
        if not secret or not hmac.compare_digest(given.encode(), secret.encode()):
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        event = request.data.get("event") if isinstance(request.data, dict) else None
        if not isinstance(event, dict):
            return Response(status=status.HTTP_400_BAD_REQUEST)
        services.handle_revenuecat(event)
        # 200 even for ignored events: RevenueCat must not retry them forever.
        return Response(status=status.HTTP_200_OK)
