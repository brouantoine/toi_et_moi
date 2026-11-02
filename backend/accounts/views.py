from collections.abc import Sequence

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import services, social
from .models import User
from .serializers import (
    AuthResponseSerializer,
    EmailSerializer,
    ErrorCodeSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    RegisterSerializer,
    SocialAuthResponseSerializer,
    SocialLoginSerializer,
    TokenSerializer,
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


class MeView(generics.RetrieveUpdateAPIView[User]):
    """The authenticated user's own profile. Nobody else's profile is reachable here."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self) -> User:
        return self.request.user  # type: ignore[return-value]


class VerifyEmailView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=TokenSerializer, responses={204: None, 400: None})
    def post(self, request: Request) -> Response:
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ok = services.verify_email(serializer.validated_data["token"])
        return Response(status=status.HTTP_204_NO_CONTENT if ok else status.HTTP_400_BAD_REQUEST)


class ResendVerificationView(AuthThrottleMixin, APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        services.send_verification_email(request.user)  # type: ignore[arg-type]
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(AuthThrottleMixin, APIView):
    """Always answers 204: never reveals whether the email has an account."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=EmailSerializer, responses={204: None})
    def post(self, request: Request) -> Response:
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(serializer.validated_data["email"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetConfirmView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=PasswordResetConfirmSerializer, responses={204: None, 400: None})
    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            ok = services.confirm_password_reset(data["uid"], data["token"], data["new_password"])
        except DjangoValidationError as exc:
            return Response({"new_password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        if not ok:
            return Response({"token": ["invalid"]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SocialLoginView(AuthThrottleMixin, APIView):
    """Sign in with Apple / Google: the identity token is verified server-side."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=SocialLoginSerializer,
        responses={200: SocialAuthResponseSerializer, 400: ErrorCodeSerializer},
    )
    def post(self, request: Request, provider: str) -> Response:
        serializer = SocialLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            if provider == "apple":
                identity = social.verify_apple(data["id_token"], data["nonce"], data["first_name"])
            elif provider == "google":
                identity = social.verify_google(data["id_token"], data["first_name"])
            else:
                return Response({"code": "unknown_provider"}, status=status.HTTP_400_BAD_REQUEST)
            user, created = services.sign_in_with_identity(identity, data["language"])
        except social.SocialAuthError as exc:
            return Response({"code": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        payload = {
            **services.issue_tokens(user),
            "user": UserSerializer(user, context={"request": request}).data,
            "created": created,
        }
        return Response(payload)
