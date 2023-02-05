---
title: "A Date Hierarchy for Neo4j"
date: 2016-02-27
draft: false
tags: ["development", "neo4j"]
---

I wrote this a while ago based on this [excellent post](http://www.markhneedham.com/blog/2014/04/19/neo4j-cypher-creating-a-time-tree-down-to-the-day/) and added a few more attributes. Given that [Neo4j](http://neo4j.com/) doesn't have a datatype to deal with dates it might come in handy for you too.

It will generate a calendar between the years specified at the top of the script (`1970` to `2050`) and create `Day` vertexes with attributes of `year`, `month`, `day`, `dayName` (day of week) and `workDay` (binary). It will then generate create `NEXT` directed edges between each `Day`, `Month` and `Year` object and create the `HAS_MONTH` and `HAS_DAY` edges to join `Year` to `Month` to `Day` so you can traverse the hierarchy quickly.

```sql
WITH
   range (1970, 2050) AS years
  ,range (1,12) AS months
  ,['January','February','March','April','May','June','July','August','September','October','November','December' ] AS monthName
  ,['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as dayName
  ,[0,1,1,1,1,1,0] as workDay
  ,[11,12,1,2,3,4,5,6,7,8,9,10] AS monthTable
FOREACH (year IN years |
  MERGE (y:Year {year: year})
  FOREACH (month IN months |
    CREATE (m:Month {year: year, month: month, Name: monthName[month-1] + ' ' + year})
    MERGE (y)–[:HAS_MONTH]->(m)
    FOREACH (day IN (CASE
      WHEN month IN [1,3,5,7,8,10,12] THEN range (1,31)
      WHEN month = 2 THEN
        CASE
          WHEN year % 4 <> 0 THEN range (1, 28)
          WHEN year % 100 <> 0 THEN range (1, 29)
          WHEN year % 400 <> 0 THEN range (1, 29)
          ELSE range (1,28)
        END
      ELSE range (1,30)
    END) |
      CREATE (d:Day {
         year: toInt(year)
        ,month: toInt(month)
        ,day: toInt(day)
        ,Name: day+' '+monthName[month-1]+' '+ year
        ,dateKey: toInt(
          toString(year)
          + CASE WHEN length(toString(month)) = 1 THEN '0'+toString(month) ELSE toString(month) END
          + CASE WHEN length(toString(day)) = 1 THEN '0'+toString(day) ELSE toString(day) END
        )
        ,dayName: dayName[toInt(
              (
              toFloat(day)
              +floor(2.6 * toFloat(monthTable[month-1]) - 0.2)
              -toFloat(2*toInt(left(toString(year),2)))
              +toFloat(right(toString(CASE WHEN month IN [1,2] THEN year-1 ELSE year END),2))
              +floor(toFloat(right(toString(CASE WHEN month IN [1,2] THEN year-1 ELSE year END),2))/4)
              +floor(toFloat(left(toString(year),2))/4)
              ) % 7
            )]

        ,workDay: toInt(workDay[toInt(
              (
              toFloat(day)
              +floor(2.6 * toFloat(monthTable[month-1]) - 0.2)
              -toFloat(2*toInt(left(toString(year),2)))
              +toFloat(right(toString(CASE WHEN month IN [1,2] THEN year-1 ELSE year END),2))
              +floor(toFloat(right(toString(CASE WHEN month IN [1,2] THEN year-1 ELSE year END),2))/4)
              +floor(toFloat(left(toString(year),2))/4)
              ) % 7
            )])
      })
      MERGE (m)–[:HAS_DAY]->(d)
    )
  )
)


WITH *

MATCH (year:Year)–[:HAS_MONTH]->(month)–[:HAS_DAY]->(day)
WITH DISTINCT year, month, day
ORDER BY year.year, month.month, day.day
WITH collect(day) as days
FOREACH (i in RANGE(0, length(days)-2) |
  FOREACH (day1 in [days[i]] |
    FOREACH (day2 in [days[i+1]] |
      CREATE UNIQUE (day1)–[:NEXT]->(day2)
    )
  )
)

WITH *

MATCH (year:Year)–[:HAS_MONTH]->(month)
WITH DISTINCT year, month
ORDER BY year.year, month.month
WITH collect(month) as months
FOREACH (i in RANGE(0, length(months)-2) |
  FOREACH (month1 in [months[i]] |
    FOREACH (month2 in [months[i+1]] |
      CREATE UNIQUE (month1)–[:NEXT]->(month2)
    )
  )
)

WITH *

MATCH (year:Year)
WITH DISTINCT year
ORDER BY year.year
WITH collect(year) as years
FOREACH (i in RANGE(0, length(years)-2) |
  FOREACH (year1 in [years[i]] |
    FOREACH (year2 in [years[i+1]] |
      CREATE UNIQUE (year1)–[:NEXT]->(year2)
    )
  )
)

```