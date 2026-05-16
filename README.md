# Shaadi Biodata PDF Maker

A very small local app for creating a one-page Shaadi biodata with a live preview and browser PDF export.

## Requirements

- Java 21
- Maven 3.9+

## Run Locally

1. Start the app:

```bash
mvn spring-boot:run
```

2. Open:

```text
http://localhost:8080
```

Fill the details, watch the A4 preview update live, then click **Save & Generate PDF**. In the print dialog, choose **Save as PDF**.

## Notes

- Details are saved in your browser's local storage on this machine.
- No database or internet connection is required after the app is running.
- The output is designed as a single A4 portrait biodata PDF.
