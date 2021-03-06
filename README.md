# Simplest baby tracker

This is a web application used to track baby events in its simplest form: it only tracks the *last event time*, and nothing else.

It runs as a website, using `localStorage` to keep track of events. Therefore, it doesn't perform any remote loading, so it can be ran locally or deployed anywhere.

<p align="center">
<kbd><a href="https://simplest-baby-tracker.netlify.com/"><img src="assets/preview.png" width="300"></a></kbd>
</p>

Pushes to the `master` branch will update the application running at [https://simplest-baby-tracker.netlify.com/](https://simplest-baby-tracker.netlify.com/). The recommendation is that users can visit this URL and add the bookmark to the home screen to have it run as a web app.

There's no build process or bundling of any kind involved. The code inside `/dist` is both the source code and the deployable app.

While many complex baby tracking apps exist, my opinion is that they create friction and anxiety around what is already a stressful task. We shouldn't need to track, chart and benchmark a baby's every second. And yet, we still need to have an idea of when was the last time something happened (e.g. when did the baby start sleeping). We decided to move from [Huckleberry](https://huckleberrycare.com/) to a very simple, last-event-only application, and this is the result.
