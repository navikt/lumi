FROM cgr.dev/chainguard/jre:openjdk-21

WORKDIR /app

COPY build/libs/app.jar app.jar

ENV TZ="Europe/Oslo"
ENV JAVA_TOOL_OPTIONS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"

EXPOSE 8080

ENTRYPOINT ["java", "-jar"]
CMD ["app.jar"]
