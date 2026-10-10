from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FromAnswerKeyView, ImportPDFView, PublicQuizView, QuizViewSet, StartQuizView, StudentGroupViewSet, StudentViewSet, SubmitQuizView

router = DefaultRouter()
router.register('quizzes', QuizViewSet, basename='quiz')
router.register('groups', StudentGroupViewSet, basename='group')
router.register('students', StudentViewSet, basename='student')

urlpatterns = [
    path('quizzes/import-pdf/', ImportPDFView.as_view(), name='import-pdf'),
    path('quizzes/from-answer-key/', FromAnswerKeyView.as_view(), name='from-answer-key'),
    path('', include(router.urls)),
    path('public/quizzes/<str:code>/', PublicQuizView.as_view(), name='public-quiz'),
    path('public/quizzes/<str:code>/start/', StartQuizView.as_view(), name='start-quiz'),
    path('public/quizzes/<str:code>/submit/', SubmitQuizView.as_view(), name='submit-quiz'),
]
