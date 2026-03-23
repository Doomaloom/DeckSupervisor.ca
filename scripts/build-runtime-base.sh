#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${IMAGE_NAME:-registry.fly.io/decksupervisor}"
IMAGE_TAG="${IMAGE_TAG:-runtime-base-latest}"
IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-linux/amd64}"
USE_BUILDX="${USE_BUILDX:-1}"

cd "$ROOT_DIR"

echo "Building runtime base image: $IMAGE_REF"

if [[ "$USE_BUILDX" == "1" ]]; then
  if [[ "${PUSH_IMAGE:-1}" == "1" ]]; then
    docker buildx build \
      --platform "$IMAGE_PLATFORM" \
      -f backend/Dockerfile.runtime-base \
      -t "$IMAGE_REF" \
      --push \
      .
  else
    docker buildx build \
      --platform "$IMAGE_PLATFORM" \
      -f backend/Dockerfile.runtime-base \
      -t "$IMAGE_REF" \
      --load \
      .
  fi
else
  docker build -f backend/Dockerfile.runtime-base -t "$IMAGE_REF" .

  if [[ "${PUSH_IMAGE:-1}" == "1" ]]; then
    echo "Pushing runtime base image: $IMAGE_REF"
    docker push "$IMAGE_REF"
  fi
fi

echo
echo "Runtime base image ready:"
echo "  $IMAGE_REF"
echo "Platform:"
echo "  $IMAGE_PLATFORM"
echo
echo "Deploy with:"
echo "  fly deploy --build-arg RUNTIME_BASE_IMAGE=$IMAGE_REF"
