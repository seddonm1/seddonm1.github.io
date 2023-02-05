---
title: "Computing WikiPedia's internal PageRank with Apache Spark"
date: 2015-11-14
draft: false
tags: ["development", "spark"]
---

Recently I have spent a lot of time reading and learning about graphs and graph analytics which naturally drew me to [Apache Spark GraphX](https://spark.apache.org/graphx/) having previously played with [Neo4J](http://neo4j.com/). The benefits of GraphX are:

- fully open source
- scalable using the Apache Spark model
- written in Scala which I have been meaning to learn
- already has basic graph algorithms such as [PageRank](https://en.wikipedia.org/wiki/PageRank)

There is a great resource for learning the basics of Apache Spark provided by Berkeley's [AMP Camp](http://ampcamp.berkeley.edu/) where you can follow very well documented tutorials including one on calculating PageRank on very small subset of Wikipedia data which has been preprocessed by them to simply the tutorials. This post extends their tutorial to loading a full set of Wikipedia's most recent backup to the point of executing the PageRank.


### 1. Know your data
The first step is to understand the file formats available from [WikiPedia's Database Backups](https://en.wikipedia.org/wiki/Wikipedia:Database_download). WikiPedia uses [MariaDB](https://mariadb.com/) and does a full database dump at the start of each month. These backups are getting very large but fortunately to calculate PageRank we only need two of the many files:

- `enwiki-20151002-page.sql.gz` (1.2GB) which stores the unique id, titles and metadata for each WikiPedia page
- `enwiki-20151002-pagelinks.sql.gz` (4.6 GB) which stores the links between internal WikiPedia pages
These files are provided already gzipped which makes them slightly more manageable. I have unzipped them both and stripped out some sample data so that this tutorial can work.

The files contain a lot of metadata and MySQL commands which we don't want as we are only interested in the rows which start with `INSERT INTO`. We still need to be able handle all the other rows as I am lazy and don't want to manually edit the text files each time I load the data - particularly when the raw `enwiki-20151002-pagelinks.sql` file is around 35GB uncompressed.

For this example I have heavily modified these files to extract records which are going to create a micrograph for testing based around Nirvana's 1991 album [Nevermind](https://en.wikipedia.org/wiki/Nevermind).

Here is the minified `page` table extract. You can save this file as `enwiki-20151002-page-sm.sql`.

```sql
-- MySQL dump 10.13  Distrib 5.5.44, for debian-linux-gnu (x86_64)
--
-- Host: 10.64.32.23    Database: enwiki
-- ------------------------------------------------------
-- Server version	5.5.5-10.0.16-MariaDB-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `page`
--

DROP TABLE IF EXISTS `page`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `page` (
  `page_id` int(8) unsigned NOT NULL AUTO_INCREMENT,
  `page_namespace` int(11) NOT NULL DEFAULT '0',
  `page_title` varbinary(255) NOT NULL DEFAULT '',
  `page_restrictions` tinyblob NOT NULL,
  `page_counter` bigint(20) unsigned NOT NULL DEFAULT '0',
  `page_is_redirect` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `page_is_new` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `page_random` double unsigned NOT NULL DEFAULT '0',
  `page_touched` varbinary(14) NOT NULL DEFAULT '',
  `page_links_updated` varbinary(14) DEFAULT NULL,
  `page_latest` int(8) unsigned NOT NULL DEFAULT '0',
  `page_len` int(8) unsigned NOT NULL DEFAULT '0',
  `page_content_model` varbinary(32) DEFAULT NULL,
  PRIMARY KEY (`page_id`),
  UNIQUE KEY `name_title` (`page_namespace`,`page_title`),
  KEY `page_random` (`page_random`),
  KEY `page_len` (`page_len`),
  KEY `page_redirect_namespace_len` (`page_is_redirect`,`page_namespace`,`page_len`)
) ENGINE=InnoDB AUTO_INCREMENT=48043691 DEFAULT CHARSET=binary;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `page`
--

/*!40000 ALTER TABLE `page` DISABLE KEYS */;
INSERT INTO `page` VALUES (143294,0,'Nevermind','',184,0,0,0.0731898286130185,'20150930071645','20150930071645',683430869,59319,'wikitext'),(143978,0,'Nirvana\'s_Smells_Like_Teen_Spirit','',5,1,0,0.5825380967767331,'20150930063333',NULL,132735942,38,'wikitext'),(1056254,0,'In_Bloom','',0,0,0,0.6394936561769999,'20150930070821','20150930070821',683429998,15190,'wikitext');
INSERT INTO `page` VALUES (1055714,0,'Come_as_You_Are_(Nirvana_song)','',0,0,0,0.831843581904,'20151003185132','20151003185132',683970810,17998,'wikitext'),(1069194,0,'Lithium_(Nirvana_song)','',0,0,0,0.609460954838,'20150930070554','20150930070554',683429758,12444,'wikitext');
/*!40000 ALTER TABLE `page` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2015-10-04 10:11:57
```

Here is the minified `pagelinks` table extract. You can save this file as `enwiki-20151002-pagelinks-sm.sql`.

```sql
-- MySQL dump 10.13  Distrib 5.5.44, for debian-linux-gnu (x86_64)
--
-- Host: 10.64.32.23    Database: enwiki
-- ------------------------------------------------------
-- Server version	5.5.5-10.0.16-MariaDB-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `pagelinks`
--

DROP TABLE IF EXISTS `pagelinks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pagelinks` (
  `pl_from` int(8) unsigned NOT NULL DEFAULT '0',
  `pl_namespace` int(11) NOT NULL DEFAULT '0',
  `pl_title` varbinary(255) NOT NULL DEFAULT '',
  `pl_from_namespace` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `pl_from` (`pl_from`,`pl_namespace`,`pl_title`),
  KEY `pl_namespace` (`pl_namespace`,`pl_title`,`pl_from`),
  KEY `pl_backlinks_namespace` (`pl_from_namespace`,`pl_namespace`,`pl_title`,`pl_from`)
) ENGINE=InnoDB DEFAULT CHARSET=binary;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pagelinks`
--

/*!40000 ALTER TABLE `pagelinks` DISABLE KEYS */;
INSERT INTO `pagelinks` VALUES (143294,0,'Come_as_You_Are_(Nirvana_song)',0),(143294,0,'Smells_Like_Teen_Spirit',0),(143294,0,'Lithium_(Nirvana_song)',0);
INSERT INTO `pagelinks` VALUES (143294,0,'In_Bloom',0),(143294,0,'Polly_(song)',0);
/*!40000 ALTER TABLE `pagelinks` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2015-10-04  7:20:12
```

From these files we have learnt:

- if we can use the gzipped versions we will be able to reduce network volume and disk storage requirements*
- we need a way of handling rows we don't care about (e.g. `CREATE TABLE` commands).
- we need a method for extracting one or more records on each line
- we need a way of selecting only the WikiPedia [namespaces](https://meta.wikimedia.org/wiki/Help:Namespace) that are in scope
- WikiPedia's `pagelinks` uses two different types of keys: a numeric key (`pl_from`) for the source `page` and a string key (`pl_title`) referring to the target's `page` title so we are going to have to do a bit of work to normalise it. This can be confirmed by viewing WikiPedia's [pagelinks](https://www.mediawiki.org/wiki/Manual:Pagelinks_table) documentation
- because we have the `CREATE TABLE` statements we can see field definitions including name and datatypes which will come in handy. WikiPedia also provides [full documentation](https://en.wikipedia.org/wiki/MediaWiki) on their database structure
- these strings are huge so we need to manage this in a way which will not cause out of memory issues

### 2. Load the Files
Copy the two files from the previous step to somewhere on your filesystem that can be accessed by your Apache Spark process. For development we are going to execute these Scala scripts using the `bin/spark-shell` utility:
```bash
bin/spark-shell -i filename.scala
```

#### 2.1 Setting up
First I am going to define my imports and a timestamp which we will use later to see how performant this code is.
```scala
import org.apache.spark.graphx._
import org.apache.spark.rdd.RDD

val timestampStart: Long = System.currentTimeMillis
```

#### 2.2 Load and Parse the Data
Define the RDDs which read the text files from the disk. Currently we are using the minified files which I created and pasted above but the SparkContext is smart enough to be able to read gzipped files which meets the first of our requirements.
```scala
// Load the textFiles as RDD. Spark will auto-partition
val page: RDD[String] = sc.textFile(""data/wiki/enwiki-20151002-page-sm.sql"")
val pagelink: RDD[String] = sc.textFile(""data/wiki/enwiki-20151002-pagelinks-sm.sql"")
```

From the AMP Camp example we know we can read a RDD[String] by calling the `map` function which will operate over each line. This means if we can work out a way to check each line to see if it contains the INSERT INTO data we care about we can meet our second requirement. My answer is to use regex to perform a pattern match to see if any relevant data appears on each line. The beauty of using regex is that it can meet multiple requirements at once:

- we can easily ignore rows that do not contain relevant data
- we can use it to extract one or multiple records from each line
- we can use it to filter out only the records in the namespace that we care about

```scala
// Define the REGEX to scrape from the page MySQL dump
val pagePattern = ""\\((\\d*),0,'([^,]*?)','.*?\\)+[,|;]"".r
```

This expression will:

- find text which starts with a `(` and ends with a `)` followed by either a `,` or `;`
- within that text find and capture a series of digits (`\d`) directly following the opening `(` which is the `page_id` field
- make sure that after that initial number there is a `,0,` which will filter the records  by the `page_namespace` field for only `0` which is the `main` namespace 
- find an extract all data between the `'` characters which is the `page_title` field

To execute this against the dataset we want to use the same expression in two ways:

- first `findAllMatchIn` will search and extract all the matches for a single `line` and place them into an array called `matches`. This means if a line has multiple records on it they will all be extracted individually and stored in an array for that line. It also means that any line which does not have a matching pattern will be ignored.
- then for each match in the `matches` array map the extracted values (the `page_id` and `page_title` values) to store them in the pageRDD RDD[(String, Long)].

This code uses a `flatMap` instead of `map` of each line in the input file as we are expecting one line to produce one or more output objects and `map` will not work with more than one result. I am not sure of the performance impact of using `flatMap` everywhere instead of `map` as a issue preventative measure but presumably there is enough impact or there would not be two methods.

```scala
// Extract the page data into the pageRDD
val pageRDD: RDD[(String, Long)] = page.flatMap { line =>
  val matches = pagePattern.findAllMatchIn(line).toArray
  matches.map { d =>
    // ""page_title"",""page_id""
    (d.group(2), d.group(1).toLong)
  }
}.setName(""pageRDD"").cache()
```

You can see that I am not storing the values in a using the conventional primary key `page_id` then value `page_title` like a relational database design but I have actually stored the `page_title` first. This is because I need to use the `page_title` field to join from my `pagelinks` dataset and the RDD `join` method requires keys to be in the first field.

Finally I also use the `setName` method to apply a nice name which will show up in the Spark Application browser so I can easily work out which RDD is stored in memory.

The `pagelinks` data is processed in much the same way but in this case a slightly different regex is used as we want only the records which have a target `pl_namespace = 0` and `pl_from_namespace = 0`. 

```scala
// Define the REGEX to scrape from the pagelinks MySQL dump
val pagelinksPattern = ""\\((\\d*),0,'([^,]*?)',0\\)+[,|;]"".r
// Extract the pagelink data into the pagelinksRDD
val pagelinksRDD: RDD[(String, Long)] = pagelink.flatMap { line =>
  val matches = pagelinksPattern.findAllMatchIn(line).toArray
  matches.map { d =>
    // ""pl_title"",""pl_from""
    (d.group(2), d.group(1).toLong)
  }
}.setName(""pagelinksRDD"").cache()
```

To see that this has worked you can execute these commands:
```scala
// Show number of records in each RDD
println(s""pageRDD: ""+pageRDD.count())
println(s""pagelinksRDD: ""+pagelinksRDD.count())
```

of if you want to see the first 10 records of the data in the shell:
```scala
// Show the first 10 records of each RDD
pageRDD.take(10)
pagelinksRDD.take(10)
```

### 3. Join the Data
So we have used regex to do the heavy lifting and extract the data into nice RDDs but we still have the problem of the two different types of keys in the `pagelinks` dataset (one numeric and one string). This means we need to do a join from the `pagelinksRDD` to the `pageRDD` using the `page_title` and `pl_title` as keys.

For example, we need to join join page `143294` to page `1055714` using `Come_as_You_Are_(Nirvana_song)` as our join key.

```sql
-- enwiki-20151002-pagelinks-sm.sql
(143294,0,'Come_as_You_Are_(Nirvana_song)',0)

-- enwiki-20151002-page-sm.sql
(143294,0,'Nevermind','',184,0,0,0.0731898286130185,'20150930071645','20150930071645',683430869,59319,'wikitext')
(1055714,0,'Come_as_You_Are_(Nirvana_song)','',0,0,0,0.831843581904,'20151003185132','20151003185132',683970810,17998,'wikitext')
```

So here you have a choice. You can either continue using Scala or you can use SparkSQL commands.

##### 3.1. SparkSQL
Initially I used SparkSQL as I have a lot more experience using SQL than Scala (and I am sure this applies to most of you). The benefits of this approach is that SQL is so ingrained that you don't really have to think to write it. Also, Spark has such a nice API and has heavily optimised dataframes.

The first step is to convert the `pageRDD` and `pagelinksRDD` to datafames with `.toDF()`. You then need to call `registerTempTable` to register them with SparkSQL.
```scala
// Convert the pageRDD and pagelinksRDD to DataFrames and register them with the sqlContext
pageRDD.toDF(""page_title"",""page_id"").registerTempTable(""page"")
pagelinksRDD.toDF(""pl_title"",""pl_from"").registerTempTable(""pagelinks"")
```

When we called the `.toDF()` method we also passed the field names so that the SQLContext will already have the metadata (read: field names and types) available for querying and so this very simple SQL query will work:

```scala
val pagelinksDF = sqlContext.sql(""SELECT pagelinks.pl_from as srcId, page.page_id as tgtId, 0 as attr FROM pagelinks INNER JOIN page ON pagelinks.pl_title = page.page_title"")
```

Now we have a result set it is easy enough to map it to the `org.apache.spark.graphx.Edge` class.

```scala
val edges = pagelinksDF.map { pagelink =>
    Edge(pagelink.getLong(0), pagelink.getLong(1), pagelink.getInt(2))
}.setName(""edges"").cache()
```

##### 3.2. Scala
If we want to use Scala and do it we need to use the `join` method. `join` requires that the join keys are in the first field of the two datasets to be joined but as we have prepared the data in this way already we can go ahead an join in one command:

```scala
// Join the RDDs using the title as the key and map the objects to the Edge object
val edges = pageRDD.join(pagelinksRDD).map {
  case (title, (page_id, pl_from)) => Edge(pl_from, page_id, 0)
}.setName(""edges"").cache()
``` 

If we hadn't organised our data with the key in the first fields then we would either have to remap the data so it was correctly ordered or we could call the `keyBy` function. This function will map each object so that it is a `(key, value)` pair where the key is the value passed into the function and the value is the original object. By doing the prework in the initial text reader we have saved a lot of unnecessary remapping and also reduce storage requirements as we are not storing the `pl_title` twice.

``` scala
val pagelinksRDDKeyByTitle = pagelinksRDD.keyBy(_.2)

// pagelinksRDDKeyByTitle
(Smells_Like_Teen_Spirit,(143294,Smells_Like_Teen_Spirit))
```


### 4. Map the Vertices
So we have cleaned up the Edges now we can easily map the pageRDD to the correct `org.apache.spark.graphx.Vertex` format. All we are doing here swapping the order of the `page_id` and `page_title`.

```scala
// Convert the pageRDD to the Vertex class
val vertices = pageRDD.map { d =>
    (d._2, d._1)
}.setName(""vertices"").cache()
```

### 5. Generate the Graph
Now we have our datasets sorted we just need to create the graph. As the AMP Camp guys nicely point out, the third parameter of the Graph constructor is the default vertex value if an edge exists without a matching vertex. This will never happen in our case as we have inner joined the datasets explicitly in SQL:
```sql
pagelinks INNER JOIN page
```
or by using the `join` RDD method:
```scala
pageRDDKeyByTitle.join(pagelinksRDDKeyByTitle)
```

Both languages have the standard `LEFT JOIN`/`leftOuterJoin()` and `FULL OUTER JOIN`/`fullOuterJoin()` behaviours implemented if needed which might make the third `Graph` constructor parameter useful.

To build the graph:
```scala
val graph = Graph(vertices, edges, """").setName(""graph"").cache()
```

### 6. Run PageRank
To execute the PageRank just call the pageRank function where the 0.001 is the error tolerance. I have shamelessly copied the code from AMP Camp for the output.

I also put an output to see how long the job ran for as it can help with performance tuning.

```scala
val prGraph = graph.pageRank(0.001).cache()

val titleAndPrGraph = graph.outerJoinVertices(prGraph.vertices) {
  (v, title, rank) => (rank.getOrElse(0.0), title)
}

titleAndPrGraph.vertices.top(10) {
  Ordering.by((entry: (VertexId, (Double, String))) => entry._2._1)
}.foreach(t => println(t._2._2 + "": "" + t._2._1))

val timestampEnd: Long = System.currentTimeMillis
val duration: Long = timestampEnd - timestampStart
println(s"""Duration: ${duration} ms (~${duration/1000/60} minutes)""")
```