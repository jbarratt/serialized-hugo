+++
date = "2017-06-23T11:59:49-07:00"
description = "Using python visualization to identify and improve around the clock performance"
title = "Improving 24x7 coverage through visualization"
slug = "visualizing_24x7"
+++

## Visualizing weeks with a Grid Heat Map

I've often been a part of, or responsible for some kind of 24x7 team coverage, or an application or platform's performance which needs to be solid 24x7.

For example, imagine an operations team running a product out of multiple facilities in different countries. Are there certain times of day or week where we may have a coverage gap that needs to be addressed, perhaps during a handoff between one team and another?  Or if we're managing a backend API -- are there consistent times of day or week where latency is getting too close to the zone where we need to worry about it?

There are 2 kinds of questions I was hoping to get better answers to in these areas. First, where are things looking great, and where do we need to improve; and second, how well are our improvement efforts going?

There's a visualization technique called a [Grid Heat Map](https://www.3pillarglobal.com/insights/grid-heat-maps-data-visualization) which seemed like a perfect fit.

On one axis, you put the days of the week; on the other, the hour of the day. Like so:

<img src="/images/visualizing_24_7/overall.svg" width="90%"/>

Instead of borrowing some data from work, (and having a chat with legal to make sure that was ok), what you're looking at is how good I am at replying to *personal* email, based on the time of day a message comes in.

So if you email me at Wednesday at 9am, I'll probably get back to you within 2 hours. If you're sending at 10pm on a Sunday night, don't get your hopes up -- I'll probably talk to you in 18 hours.

I like how clearly the general trends pop out. Monday, I'm in it to win it, low latency all day. As the week goes on, I'm still focused during core business hours, but you can see how it starts to be more and more core-centric as Friday approaches. By Saturday, I'm done with computers. Sunday, I'll catch up on things before my kids are up, and a bit during the quiet time in the afternoon, but my responsiveness really drops off during Peak Brunch Hours. (Visual proof that I have really adopted Portland ideals.)

I don't send a massive amount of email, so the data is a little gappy; "20 hours" is the effective maximum, so 20s are similar to "not enough data."

The visualization actually does a pretty good job of solving the first goal -- if it was my job to be good at replying to email 24x7, it's pretty obvious where improvement needs to be focused.

This technique also works well for quantifying and analyzing change over time. For example:

Here is just the data for 2015:
<img src="/images/visualizing_24_7/2015.svg" width="90%"/>

And just the data for 2016:
<img src="/images/visualizing_24_7/2016.svg" width="90%"/>

And here's the differences between them:
<img src="/images/visualizing_24_7/difference.svg" width="90%"/>

Negative numbers represent an improvement in response time, positive represents getting worse.

Again, more data would really help with the consistency, but there are some notable trends, e.g. you can make a case that in 2016 I started my personal email day closer to 7am than 6am, as I did in 2015, and you can also see that around 9-11pm I was much more responsive in 2016. So, the data shows, my bedtime shifted. (Which in retrospect it has, as my kids have been sleeping better, and the older ones staying up later -- also, I switched from a gym-based to home-based fitness program, so I don't have to leave the house at 5am anymore.)

I can see this being potentially a very useful tool in general for organizational/operational troubleshooting, especially for systems where the resolution of the data is going to be a bit higher. Other fun possible use cases include:

* Service/backend latency
* Operational factors (ticket response times, delay to ack issues, alert frequency in general, etc)
* Capacity planning ("when do people use a thing, when should I pre-scale per day")
* Team activity (commits, reviews, deploys, slacks)
* Growth hacking use cases, like orders/signups/visits/social touches

## Making Grid Heat Maps with Python

Making these heat maps is actually quite straightforward, thanks to the hard work that's been done in the python data processing and visualization ecosystem. The general recipe I followed to make these charts was:

1. Start up the [Jupyter Notebook](http://jupyter.org/)
2. Process the data to fit in a [Pandas](http://pandas.pydata.org/) DataFrame
3. Aggregate the data by day of week vs hour of day
4. Visualize the data with [Seaborn](https://seaborn.pydata.org/)

### Jupyter Notebook

I'm a fan of the Jupyter Notebook, previously known as IPython Notebook. I even [gave a talk about it](https://www.youtube.com/watch?v=XkXXpaVpNSc) at OSCON a few years ago. Especially for this kind of workload, it excels, because you can iteratively hack through all 4 parts of that process before baking them into something persistent. These days I run it in docker, as it makes getting it running with all dependencies incredibly easy. Also, I can run the notebook on a beefy yet efficient Intel NUC in the garage, and work on it remotely from my laptop, phone or tablet.

The Jupyter project provides some excellent containers of various flavors with the [docker-stacks](https://github.com/jupyter/docker-stacks) project. For this, I'm using the Data Science notebook. This command will start the notebook running, working on the current directory (I use a dropbox folder for easy persistence and sharing), with the notebook running as my host user and group, so it can edit/write files as me, and no password, since I'm running it on a private network.

```
$ docker run -d -p 8801:8888 -v $(pwd):/home/jovyan/work --user root -e NB_UID=$(id -u) -e NB_GID=$(id -g) jupyter/datascience-notebook start-notebook.sh --NotebookApp.token=''
```

### Processing the data

I got the email data from the excellent [Google Takeout](https://takeout.google.com/settings/takeout/custom) service, which provided a 1.3GB mbox format of my `Sent` folder, perfect for this use case. Python includes a [mailbox library](https://docs.python.org/3/library/mailbox.html), so the file could be parsed without installing anything further.

Calculating the response time was actually fairly simple. All messages have a unique ID, and when you're replying to another message, an `In-Reply-To` header is included, which references the other ID.

The algorithm to extract the delay then becomes:

* Extract the `Message-Id` and timestamp for each email I *did not* send
* Find the difference between that time, and the time the original was sent, for every email I *did* send in reply to another message.

This takes a few minutes to run, and if it was going to need to run frequently there are more efficient ways to process it, but for a one off script it's fine. This is one of the nice things about the Jupyter notebook; expensive, exploratory things like this can be run once, and then the results tinkered with in memory.

```python
mbox = mailbox.mbox('Takeout/Mail/Sent.mbox')

# build a dict of (message ID) => Date message was sent.
replied_to = {x['Message-Id']: x['Date'] for x in mbox if 'serialized.net' not in x['From']}

responsetimes = []
for message in mbox:
    # ignore any messages that aren't from me, or aren't replies
    if 'serialized.net' not in message['From'] or \
        'In-Reply-To' not in message or \
        message['In-Reply-To'] not in replied_to:
        continue
    try:
        # Attempt to figure out both the relevant dates
        rcv_date = parse(replied_to[message['In-Reply-To']]) 
        sent_date = parse(message['Date'])
    except (ValueError, TypeError):
        # skip this email if there was a parse error
        continue
    try:
        # extract the time between sent messages
        gap = sent_date - rcv_date
        seconds = gap.seconds
    except TypeError:
        # If comparing a tz/non-tz data set, 
        # turn them both to epoch seconds and use the default TZ.
        seconds = int(sent_date.strftime("%s")) - int(rcv_date.strftime("%s"))
        
    # add to a list of tuples with the Year, Day of Week, Hour, and the seconds of delay per row
    responsetimes.append((rcv_date.year, calendar.day_abbr[rcv_date.weekday()], rcv_date.hour, gap.seconds))
    

# Turn those tuples into a Pandas dataframe.
# (Way more efficient than appending to a dataframe directly.)
df = pd.DataFrame(responsetimes, columns=('Year', 'Day', 'Hour', 'Seconds'))
```

### Aggregating and visualizing the data

First, 'seconds' is not a very friendly unit of time for humans to think about, so it makes sense to add an 'Hours' column to the data.

```python
df['Hours'] = df.Seconds.apply(lambda x: float(x) / 3600)
```

Next, here is a helper function to make the grouping of data by (Hour of Day) and (Day of week).
This allows easily creating the different views on the subsets of the data without (gasp) copy/paste.

```python
def aggregate_df(df):
    # Group by Day and Hour, then aggregate by the 80th percentile of response time.
    # Based on inspection, choose 20 as the "no data" value.
    # For production this could be extracted from summary data.
    weekly = df.groupby(['Day', 'Hour'])['Hours'].quantile(.8).unstack().fillna(20.0)
        
    # The order of the days seems random, even when experimenting with Category types.
    # This corrects it for the chart. Put the weekend at the bottom so it can be seen as a unit.
    order = {y: x for x, y in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])}
    weekly = weekly.reindex_axis(sorted(weekly.index, key=lambda x: order[x]))
    return weekly
```

Once the data is properly structured, creating the above visualizations is actually incredibly simple, thanks to the hard work done by the Seaborn team.
The `plt.clf()` is needed to clear the figure between function calls, so one plot is not drawn on top of the one made previously.

Key options to the `sns.heatmap` call are to make the cells square, and to annotate them with the values -- but since they're floating point, cut off anything after the decimal for readability. And since every cell has the value printed on it, no need to have the color bar/legend.

```python
def plot_group(group, filename):
    plt.clf()
    heatmap = sns.heatmap(group, square=True, annot=True, fmt=".0f", cbar=False)
    heatmap.figure.savefig(filename, format="svg", bbox_inches="tight")
    return heatmap
```

Finally, the groups can be created and plots saved.
   
```python
# Create the view of all the data
overall = aggregate_df(df)
plot_group(overall, "overall.svg")

# Create the views just for 2015 and 2016
fifteen = aggregate_df(df[df['Year'] == 2015])
plot_group(fifteen, "2015.svg")
sixteen = aggregate_df(df[df['Year'] == 2016])
plot_group(sixteen, "2016.svg")

# Render the difference between the 2016 and 2015 values.
plot_group(sixteen-fifteen, "difference.svg")
```

My favorite is the final call -- I love that Pandas is powerful enough that these complex data tables can just be subtracted from each other, and "the right thing" happens.

## Next Steps

I started looking into this as a way to help with some specific problems we'd been facing at work, and this initial experimentation was really promising. I'd love to have a few of these targeting different factors of our operation automatically generated and available for things like retrospective meetings, or even as part of the (typically linegraph oriented) wall displays. And yet again, I'm blown away by the quality and simplicity of Python's scientific, data and visualization landscape. It's incredible that (a) this all can be done in around 40 lines of code, and (b) over half of that code is just extracting the data, not the analysis and visualization, which historically would have dominated a project like this.
