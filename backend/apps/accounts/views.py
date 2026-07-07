from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RegisterSerializer, UserSerializer


@extend_schema(tags=['Authentication'], summary='O‘qituvchi akkauntini yaratish', responses={201: UserSerializer})
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    @extend_schema(tags=['Authentication'], summary='Joriy foydalanuvchini olish', responses={200: UserSerializer})
    def get(self, request):
        return Response(UserSerializer(request.user).data)
