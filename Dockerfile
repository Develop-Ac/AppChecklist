# =========================
# Stage 1: PREP (Node + Capacitor)
# =========================
FROM node:20-slim AS prep

WORKDIR /app

# 1) Dependências NPM (espera-se que package.json e package-lock.json estejam em sincronia)
COPY package*.json ./
# Se preferir robustez quando há mismatch no lock, troque por:
# RUN npm install --package-lock-only --no-audit --no-fund && npm ci --no-audit --no-fund
RUN npm ci --no-audit --no-fund

# 2) Código do projeto (inclui /dist e capacitor.config.*)
COPY . .

# 3) Sanidade: garanta que /dist existe (se não, falhe com mensagem clara)
RUN test -d dist || (echo "ERRO: A pasta 'dist' não existe. Gere o build web antes do Docker (ex.: npm run build)." && exit 1)

# 4) Capacitor Android: adicionar plataforma e copiar assets
# (em build do zero sempre precisa do 'add'; se quiser, pode usar 'npx cap sync android' após o add)
RUN npx cap add android && npx cap copy android

# =========================
# Stage 2: ANDROID BUILD (JDK17 + Android SDK)
# =========================
FROM openjdk:17-jdk-slim AS android

ARG ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT}
ENV ANDROID_HOME=${ANDROID_SDK_ROOT}
ENV PATH=$PATH:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools

# utilitários
RUN apt-get update && apt-get install -y --no-install-recommends \
    unzip wget git ca-certificates bash \
 && rm -rf /var/lib/apt/lists/*

# 1) Instala commandline-tools do Android SDK
# (versão do zip pode mudar; este link é estável há bastante tempo)
RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdtools.zip && \
    unzip -q /tmp/cmdtools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools && \
    mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    rm /tmp/cmdtools.zip

# 2) Aceita licenças e instala pacotes necessários (ajuste versões se seu projeto usar outro compile/target)
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" \
               "platforms;android-34" \
               "build-tools;34.0.0"

WORKDIR /app

# 3) Copia o projeto já preparado (com android/ criado e assets copiados)
COPY --from=prep /app /app

# 4) Opcional: memória/encoding do Gradle
ENV GRADLE_OPTS="-Xmx2g -Dfile.encoding=UTF-8"

# 5) Build do APK de debug
WORKDIR /app/android
RUN chmod +x ./gradlew && ./gradlew --no-daemon --stacktrace assembleDebug

# =========================
# Stage 3: EXPORT (pegar o APK facilmente)
# =========================
FROM scratch AS export

# Caminho padrão do APK de debug gerado
COPY --from=android /app/android/app/build/outputs/apk/debug/app-debug.apk /app-debug.apk

# =========================
# Stage 3: EXPORT (pegar o APK facilmente)
# =========================
FROM alpine:3.20 AS export

# Copia o APK gerado no estágio anterior
COPY --from=android /app/android/app/build/outputs/apk/debug/app-debug.apk /app-debug.apk

# Define um comando válido (necessário para docker create)
CMD ["true"]