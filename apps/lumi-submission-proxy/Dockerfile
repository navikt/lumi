FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/jre:latest

WORKDIR /app

COPY build/libs/app.jar app.jar

ENV TZ="Europe/Oslo"
ENV JAVA_TOOL_OPTIONS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"

EXPOSE 8080

ENTRYPOINT ["java", "-jar"]
CMD ["app.jar"]
