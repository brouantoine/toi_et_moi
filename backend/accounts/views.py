from collections.abc import Sequence

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import services
from .serializers import (
    AuthResponseSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserSerializer,
)


class AuthThrottleMixin:
    throttle_classes: Sequence[type[BaseThrottle]] = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=RegisterSerializer, responses={201: AuthResponseSerializer})
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_user(**serializer.validated_data)
        tokens = services.issue_tokens(user)
        payload = {**tokens, "user": UserSerializer(user, context={"request": request}).data}
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(AuthThrottleMixin, TokenObtainPairView):
    pass


class RefreshView(AuthThrottleMixin, TokenRefreshView):
    pass


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=LogoutSerializer, responses={205: None})
    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.revoke_refresh_token(serializer.validated_data["refresh"])
        except TokenError:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)
