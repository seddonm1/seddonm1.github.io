---
title: "Using Apache Spark Neural Networks to Recognise Digits"
date: 2016-03-12
draft: false
tags: ["development", "spark"]
---

One of the famous machine learning challenges is the performing handwritten character recognition (classification) over the [MNIST database of handwritten digits](http://yann.lecun.com/exdb/mnist/). The MNIST dataset has a training set of 60,000 and a test set of 10,000 28x28 pixel images of handwritten digits and an integer value between 0 and 9 containing their true value.

The current best scores are [available on Wikipedia](https://en.wikipedia.org/wiki/MNIST_database) with the best score for [Neural Networks](https://en.wikipedia.org/wiki/Artificial_neural_network) currently at 0.35% error.

So let's see how we go using Apache Spark's [Multilayer Perceptron Classifier](https://spark.apache.org/docs/latest/ml-classification-regression.html#multilayer-perceptron-classifier).

### 1.0 Data Preparation
Because so many people have used this dataset there are a [lot of scripts](http://pjreddie.com/projects/mnist-in-csv/) to convert the raw MNIST data available from [http://yann.lecun.com/exdb/mnist/](http://yann.lecun.com/exdb/mnist/) into a more easily ingestible CSV format. I have already taken the CSV representation of the MNIST dataset and converted it to [Parquet](https://parquet.apache.org/) (compressed, columnar). 
### 2.0 A Base Implementation - Error rate: 2.90%
Lets start with a minimal implementation. Read the parquet files, [create a vector of the pixels](https://spark.apache.org/docs/latest/ml-features.html#vectorindexer), [index the labels](https://spark.apache.org/docs/latest/ml-features.html#stringindexer) and run a MultilayerPerceptronClassifier with two hidden layers of 784 neurons and 800 neurons (based on the Wikipedia MNIST leader board).

```scala
import org.apache.spark.ml.{Pipeline,PipelineModel}
import org.apache.spark.ml.feature.{VectorAssembler,StringIndexer,IndexToString}
import org.apache.spark.ml.classification.{MultilayerPerceptronClassifier}
import org.apache.spark.ml.evaluation.{MulticlassClassificationEvaluator}

val timestampStart: Long = System.currentTimeMillis

val train = sqlContext.read.load("data/mnist/train.parquet")
val test = sqlContext.read.load("data/mnist/test.parquet")

val label = "label"
val labels = Seq("0","1","2","3","4","5","6","7","8","9")
val features = Array("pixel0","pixel1","pixel2","pixel3","pixel4","pixel5","pixel6","pixel7","pixel8","pixel9","pixel10","pixel11","pixel12","pixel13","pixel14","pixel15","pixel16","pixel17","pixel18","pixel19","pixel20","pixel21","pixel22","pixel23","pixel24","pixel25","pixel26","pixel27","pixel28","pixel29","pixel30","pixel31","pixel32","pixel33","pixel34","pixel35","pixel36","pixel37","pixel38","pixel39","pixel40","pixel41","pixel42","pixel43","pixel44","pixel45","pixel46","pixel47","pixel48","pixel49","pixel50","pixel51","pixel52","pixel53","pixel54","pixel55","pixel56","pixel57","pixel58","pixel59","pixel60","pixel61","pixel62","pixel63","pixel64","pixel65","pixel66","pixel67","pixel68","pixel69","pixel70","pixel71","pixel72","pixel73","pixel74","pixel75","pixel76","pixel77","pixel78","pixel79","pixel80","pixel81","pixel82","pixel83","pixel84","pixel85","pixel86","pixel87","pixel88","pixel89","pixel90","pixel91","pixel92","pixel93","pixel94","pixel95","pixel96","pixel97","pixel98","pixel99","pixel100","pixel101","pixel102","pixel103","pixel104","pixel105","pixel106","pixel107","pixel108","pixel109","pixel110","pixel111","pixel112","pixel113","pixel114","pixel115","pixel116","pixel117","pixel118","pixel119","pixel120","pixel121","pixel122","pixel123","pixel124","pixel125","pixel126","pixel127","pixel128","pixel129","pixel130","pixel131","pixel132","pixel133","pixel134","pixel135","pixel136","pixel137","pixel138","pixel139","pixel140","pixel141","pixel142","pixel143","pixel144","pixel145","pixel146","pixel147","pixel148","pixel149","pixel150","pixel151","pixel152","pixel153","pixel154","pixel155","pixel156","pixel157","pixel158","pixel159","pixel160","pixel161","pixel162","pixel163","pixel164","pixel165","pixel166","pixel167","pixel168","pixel169","pixel170","pixel171","pixel172","pixel173","pixel174","pixel175","pixel176","pixel177","pixel178","pixel179","pixel180","pixel181","pixel182","pixel183","pixel184","pixel185","pixel186","pixel187","pixel188","pixel189","pixel190","pixel191","pixel192","pixel193","pixel194","pixel195","pixel196","pixel197","pixel198","pixel199","pixel200","pixel201","pixel202","pixel203","pixel204","pixel205","pixel206","pixel207","pixel208","pixel209","pixel210","pixel211","pixel212","pixel213","pixel214","pixel215","pixel216","pixel217","pixel218","pixel219","pixel220","pixel221","pixel222","pixel223","pixel224","pixel225","pixel226","pixel227","pixel228","pixel229","pixel230","pixel231","pixel232","pixel233","pixel234","pixel235","pixel236","pixel237","pixel238","pixel239","pixel240","pixel241","pixel242","pixel243","pixel244","pixel245","pixel246","pixel247","pixel248","pixel249","pixel250","pixel251","pixel252","pixel253","pixel254","pixel255","pixel256","pixel257","pixel258","pixel259","pixel260","pixel261","pixel262","pixel263","pixel264","pixel265","pixel266","pixel267","pixel268","pixel269","pixel270","pixel271","pixel272","pixel273","pixel274","pixel275","pixel276","pixel277","pixel278","pixel279","pixel280","pixel281","pixel282","pixel283","pixel284","pixel285","pixel286","pixel287","pixel288","pixel289","pixel290","pixel291","pixel292","pixel293","pixel294","pixel295","pixel296","pixel297","pixel298","pixel299","pixel300","pixel301","pixel302","pixel303","pixel304","pixel305","pixel306","pixel307","pixel308","pixel309","pixel310","pixel311","pixel312","pixel313","pixel314","pixel315","pixel316","pixel317","pixel318","pixel319","pixel320","pixel321","pixel322","pixel323","pixel324","pixel325","pixel326","pixel327","pixel328","pixel329","pixel330","pixel331","pixel332","pixel333","pixel334","pixel335","pixel336","pixel337","pixel338","pixel339","pixel340","pixel341","pixel342","pixel343","pixel344","pixel345","pixel346","pixel347","pixel348","pixel349","pixel350","pixel351","pixel352","pixel353","pixel354","pixel355","pixel356","pixel357","pixel358","pixel359","pixel360","pixel361","pixel362","pixel363","pixel364","pixel365","pixel366","pixel367","pixel368","pixel369","pixel370","pixel371","pixel372","pixel373","pixel374","pixel375","pixel376","pixel377","pixel378","pixel379","pixel380","pixel381","pixel382","pixel383","pixel384","pixel385","pixel386","pixel387","pixel388","pixel389","pixel390","pixel391","pixel392","pixel393","pixel394","pixel395","pixel396","pixel397","pixel398","pixel399","pixel400","pixel401","pixel402","pixel403","pixel404","pixel405","pixel406","pixel407","pixel408","pixel409","pixel410","pixel411","pixel412","pixel413","pixel414","pixel415","pixel416","pixel417","pixel418","pixel419","pixel420","pixel421","pixel422","pixel423","pixel424","pixel425","pixel426","pixel427","pixel428","pixel429","pixel430","pixel431","pixel432","pixel433","pixel434","pixel435","pixel436","pixel437","pixel438","pixel439","pixel440","pixel441","pixel442","pixel443","pixel444","pixel445","pixel446","pixel447","pixel448","pixel449","pixel450","pixel451","pixel452","pixel453","pixel454","pixel455","pixel456","pixel457","pixel458","pixel459","pixel460","pixel461","pixel462","pixel463","pixel464","pixel465","pixel466","pixel467","pixel468","pixel469","pixel470","pixel471","pixel472","pixel473","pixel474","pixel475","pixel476","pixel477","pixel478","pixel479","pixel480","pixel481","pixel482","pixel483","pixel484","pixel485","pixel486","pixel487","pixel488","pixel489","pixel490","pixel491","pixel492","pixel493","pixel494","pixel495","pixel496","pixel497","pixel498","pixel499","pixel500","pixel501","pixel502","pixel503","pixel504","pixel505","pixel506","pixel507","pixel508","pixel509","pixel510","pixel511","pixel512","pixel513","pixel514","pixel515","pixel516","pixel517","pixel518","pixel519","pixel520","pixel521","pixel522","pixel523","pixel524","pixel525","pixel526","pixel527","pixel528","pixel529","pixel530","pixel531","pixel532","pixel533","pixel534","pixel535","pixel536","pixel537","pixel538","pixel539","pixel540","pixel541","pixel542","pixel543","pixel544","pixel545","pixel546","pixel547","pixel548","pixel549","pixel550","pixel551","pixel552","pixel553","pixel554","pixel555","pixel556","pixel557","pixel558","pixel559","pixel560","pixel561","pixel562","pixel563","pixel564","pixel565","pixel566","pixel567","pixel568","pixel569","pixel570","pixel571","pixel572","pixel573","pixel574","pixel575","pixel576","pixel577","pixel578","pixel579","pixel580","pixel581","pixel582","pixel583","pixel584","pixel585","pixel586","pixel587","pixel588","pixel589","pixel590","pixel591","pixel592","pixel593","pixel594","pixel595","pixel596","pixel597","pixel598","pixel599","pixel600","pixel601","pixel602","pixel603","pixel604","pixel605","pixel606","pixel607","pixel608","pixel609","pixel610","pixel611","pixel612","pixel613","pixel614","pixel615","pixel616","pixel617","pixel618","pixel619","pixel620","pixel621","pixel622","pixel623","pixel624","pixel625","pixel626","pixel627","pixel628","pixel629","pixel630","pixel631","pixel632","pixel633","pixel634","pixel635","pixel636","pixel637","pixel638","pixel639","pixel640","pixel641","pixel642","pixel643","pixel644","pixel645","pixel646","pixel647","pixel648","pixel649","pixel650","pixel651","pixel652","pixel653","pixel654","pixel655","pixel656","pixel657","pixel658","pixel659","pixel660","pixel661","pixel662","pixel663","pixel664","pixel665","pixel666","pixel667","pixel668","pixel669","pixel670","pixel671","pixel672","pixel673","pixel674","pixel675","pixel676","pixel677","pixel678","pixel679","pixel680","pixel681","pixel682","pixel683","pixel684","pixel685","pixel686","pixel687","pixel688","pixel689","pixel690","pixel691","pixel692","pixel693","pixel694","pixel695","pixel696","pixel697","pixel698","pixel699","pixel700","pixel701","pixel702","pixel703","pixel704","pixel705","pixel706","pixel707","pixel708","pixel709","pixel710","pixel711","pixel712","pixel713","pixel714","pixel715","pixel716","pixel717","pixel718","pixel719","pixel720","pixel721","pixel722","pixel723","pixel724","pixel725","pixel726","pixel727","pixel728","pixel729","pixel730","pixel731","pixel732","pixel733","pixel734","pixel735","pixel736","pixel737","pixel738","pixel739","pixel740","pixel741","pixel742","pixel743","pixel744","pixel745","pixel746","pixel747","pixel748","pixel749","pixel750","pixel751","pixel752","pixel753","pixel754","pixel755","pixel756","pixel757","pixel758","pixel759","pixel760","pixel761","pixel762","pixel763","pixel764","pixel765","pixel766","pixel767","pixel768","pixel769","pixel770","pixel771","pixel772","pixel773","pixel774","pixel775","pixel776","pixel777","pixel778","pixel779","pixel780","pixel781","pixel782","pixel783")
val layers = Array[Int](features.length, 784, 800, labels.length)

train.persist(org.apache.spark.storage.StorageLevel.MEMORY_ONLY)
test.persist(org.apache.spark.storage.StorageLevel.MEMORY_ONLY)

train.count()
test.count()

val assembler = { new VectorAssembler()
  .setInputCols(features)
}
val stringIndexer = { new StringIndexer()
  .setInputCol(label)
  .fit(train)
}
val mlp = { new MultilayerPerceptronClassifier()
  .setLabelCol(stringIndexer.getOutputCol)
  .setFeaturesCol(assembler.getOutputCol)
  .setLayers(layers)
  .setSeed(42L)
  .setBlockSize(128) //default 128
  .setMaxIter(10000) //default 100
  .setTol(1e-7) //default 1e-4
}
val indexToString = { new IndexToString()
  .setInputCol(mlp.getPredictionCol)
  .setLabels(stringIndexer.labels)
}
val pipeline = { new Pipeline()
  .setStages(Array(assembler, stringIndexer, mlp, indexToString))
}

val model = pipeline.fit(train)
val result = model.transform(test)

val evaluator = { new MulticlassClassificationEvaluator()
  .setLabelCol(stringIndexer.getOutputCol)
  .setPredictionCol(mlp.getPredictionCol)
  .setMetricName("precision")
}
val precision = evaluator.evaluate(result)

val confusionMatrix = {
  result.select(col(stringIndexer.getInputCol), col(indexToString.getOutputCol))
  .orderBy(stringIndexer.getInputCol)
  .groupBy(stringIndexer.getInputCol)
  .pivot(indexToString.getOutputCol,labels)
  .count
}

println(s"Confusion Matrix (Vertical: Actual, Horizontal: Predicted):")
confusionMatrix.show

println(s"Duration: ${(System.currentTimeMillis - timestampStart)} ms (~${(System.currentTimeMillis - timestampStart)/1000/60} minutes)")
println(s"Precision: ${precision}")
```
The output shows that this vanilla implementation will result in approximately `0.971` precision. 
```scala
Duration: 15379777 ms (~256 minutes)
Precision: 0.971
```
I have also created confusion matrix which shows the correct label (on the vertical axis) and the predicted label (horizontal axis). The way to read this is that `12` values which are should be `7` have been incorrectly classified as `2`.

```scala
+-----+---+----+---+---+---+---+---+---+---+---+
|label|  0|   1|  2|  3|  4|  5|  6|  7|  8|  9|
+-----+---+----+---+---+---+---+---+---+---+---+
|    0|971|   0|  3|  0|  0|  2|  3|  1|  0|  0|
|    1|  0|1125|  3|  1|  0|  1|  1|  0|  4|  0|
|    2|  5|   3|997|  4|  4|  0|  1| 14|  4|  0|
|    3|  0|   1|  5|984|  0|  6|  0|  7|  4|  3|
|    4|  2|   0|  4|  1|954|  2|  1|  2|  2| 14|
|    5|  5|   1|  3| 13|  2|853|  7|  1|  5|  2|
|    6|  6|   2|  1|  2|  5|  4|934|  0|  3|  1|
|    7|  0|   6| 12|  3|  3|  0|  0|993|  1| 10|
|    8|  3|   0|  4| 10|  4|  7|  3|  5|935|  3|
|    9|  2|   2|  0|  9| 10|  4|  1|  9|  8|964|
+-----+---+----+---+---+---+---+---+---+---+---+
```

### 3.0 Feature Cleaning - Error rate: 2.17%
The first change we will make to the base implementation is to clean up the features by simplifying the representation of the numbers. The best neural network implementation method for MNIST is from a paper titled [Deep Big Simple Neural Nets Excel on Handwritten Digit Recognition](http://arxiv.org/abs/1003.0358) who apply a [Binarizer](https://spark.apache.org/docs/latest/ml-features.html#binarizer) type approach with a threshold value of `127.5`. This means that any pixel which has a grayscale value of less than `127.5` will be `0.0` and anything above `127.5` will be a `1.0`. This should clean up any smearing or pixels outside the 'core' of the digit.

In Apache Spark 2.0.0 the `Binarizer` transformer will accept `Double` input types but until then you will have to manually build Spark with [my modified Binarizer](https://mike.seddon.ca/a-better-binarizer-for-apache-spark-ml/). Add/Modify the following code:

```scala
import org.apache.spark.ml.feature.{VectorAssembler,Binarizer,StringIndexer,IndexToString}

val binarizer = { new Binarizer()
  .setInputCol(assembler.getOutputCol)
  .setThreshold(127.5)
}

val mlp = { new MultilayerPerceptronClassifier()
  .setLabelCol(stringIndexer.getOutputCol)
  .setFeaturesCol(binarizer.getOutputCol)
  .setLayers(layers)
  .setSeed(42L)
  .setBlockSize(128) //default 128
  .setMaxIter(10000) //default 100
  .setTol(1e-7) //default 1e-4
}

val pipeline = { new Pipeline()
  .setStages(Array(assembler, binarizer, stringIndexer, mlp, indexToString))
}
```

With this approach we have increased our precision by 0.73% which may not sound much but would be 7,300 if we were to try to recognise 1 million digits - not insignificant.

```scala
+-----+---+----+----+---+---+---+---+----+---+---+
|label|  0|   1|   2|  3|  4|  5|  6|   7|  8|  9|
+-----+---+----+----+---+---+---+---+----+---+---+
|    0|971|   0|   2|  1|  1|  1|  1|   1|  1|  1|
|    1|  0|1127|   2|  0|  1|  2|  2|   1|  0|  0|
|    2|  5|   3|1007|  1|  2|  0|  2|   4|  8|  0|
|    3|  0|   0|   3|990|  0|  6|  0|   3|  1|  7|
|    4|  1|   2|   2|  1|956|  0|  4|   3|  0| 13|
|    5|  2|   1|   0|  8|  2|870|  2|   1|  5|  1|
|    6|  4|   3|   0|  1|  7|  5|933|   1|  4|  0|
|    7|  1|   4|   6|  4|  0|  1|  0|1003|  2|  7|
|    8|  1|   1|   2|  3|  3|  3|  1|   4|949|  7|
|    9|  2|   3|   0|  2|  9|  7|  2|   5|  2|977|
+-----+---+----+----+---+---+---+---+----+---+---+

Duration: 13986596 ms (~233 minutes)
Precision: 0.9783
```

### 4.0 Feature Engineering by Rotation - Error rate: 1.99%
As we are still a long way from the best in the world MNIST neural network performance we need to try something more radical: engineering our own features to give the `MultilayerPerceptronClassifier` more data to learn from. In the MNIST entries a lot of teams create additional features by performing 'elastic distortions' which appears to be used quite broadly when talking about the MNIST challenge ranging from simple rotations to more complex distortion based approaches. The obvious downside to this is that each `MultilayerPerceptronClassifier` iteration will now have to process more data and so each iteration will take longer.

The first we are going to try is to apply simple rotation like the winning entry of `+15°` and `-15°` and we are doing this with another custom transformer: [AffineTransform](https://mike.seddon.ca/affinetransform-transformer-for-apache-spark-ml/). 

Now this is a bit different to a normal pipeline as we only want to apply the `AffineTransform` transformer to the `train` set not both `train` and `test` which means we need to separate the `VectorAssembler` and the two `AffineTransform` stages from the pipeline and `unionAll` the results:

```scala
val assembler = { new VectorAssembler()
  .setInputCols(features)
  .setOutputCol(featuresLabel)
}
val affineTransformRotateNeg = { new AffineTransform()
  .setInputCol(assembler.getOutputCol)
  .setWidth(28)
  .setHeight(28)
  .setOperation("rotate")
  .setFactor(-15)
}
val affineTransformRotatePos = { new AffineTransform()t
  .setInputCol(assembler.getOutputCol)
  .setWidth(28)
  .setHeight(28)
  .setOperation("rotate")
  .setFactor(15)
}
val assemblerDF = assembler.transform(train).select("id",label,assembler.getOutputCol)
val affineTransformRotateNegDF = affineTransformRotateNeg.transform(assemblerDF).select("id",label,affineTransformRotateNeg.getOutputCol).withColumnRenamed(affineTransformRotateNeg.getOutputCol,"features")
val affineTransformRotatePosDF = affineTransformRotatePos.transform(assemblerDF).select("id",label,affineTransformRotatePos.getOutputCol).withColumnRenamed(affineTransformRotatePos.getOutputCol,"features")

val trainDF = assemblerDF.unionAll(affineTransformRotateNegDF).unionAll(affineTransformRotatePosDF)
val testDF = assembler.transform(test)

trainDF.persist(org.apache.spark.storage.StorageLevel.MEMORY_ONLY)
testDF.persist(org.apache.spark.storage.StorageLevel.MEMORY_ONLY)

trainDF.count()
testDF.count()
```

Modify the `Binarizer`, `Pipeline`, `model` and `result` accordingly:

```scala
val binarizer = { new Binarizer()
  .setInputCol(featuresLabel)
  .setThreshold(127.5)
}

val pipeline = { new Pipeline()
  .setStages(Array(binarizer, stringIndexer, mlp, indexToString))
}

val model = pipeline.fit(trainDF)
val result = model.transform(testDF)
```

The result:
```scala
+-----+---+----+----+---+---+---+---+----+---+---+
|label|  0|   1|   2|  3|  4|  5|  6|   7|  8|  9|
+-----+---+----+----+---+---+---+---+----+---+---+
|    0|970|   1|   1|  0|  1|  2|  2|   1|  1|  1|
|    1|  0|1128|   0|  3|  0|  1|  2|   0|  1|  0|
|    2|  1|   3|1012|  2|  2|  1|  1|   5|  5|  0|
|    3|  1|   0|   2|991|  0|  4|  0|   8|  1|  3|
|    4|  1|   0|   1|  1|966|  0|  2|   5|  0|  6|
|    5|  2|   0|   0|  6|  1|874|  5|   0|  3|  1|
|    6|  7|   2|   2|  0|  5|  4|937|   0|  1|  0|
|    7|  2|   5|   6|  4|  3|  0|  0|1001|  1|  6|
|    8|  0|   0|   5|  8|  4|  4|  0|   2|946|  5|
|    9|  0|   2|   0|  1| 13|  6|  1|   7|  3|976|
+-----+---+----+----+---+---+---+---+----+---+---+

Duration: 52917415 ms (~881 minutes)
Precision: 0.9801
```

### 5.0 Decreasing the Tolerance - Error Rate: 1.97%
One of the parameters of the MultilayerPerceptronClassifier is the 'convergence tolerance for iterative algorithms'. By decreasing this value we would expect to see the model to take longer to build but potentially be more accurate. By doing this change the runtime did increase by `3.40%` but the error rate also decreased by `0.02%`.

```scala
+-----+---+----+----+---+---+---+---+----+---+---+
|label|  0|   1|   2|  3|  4|  5|  6|   7|  8|  9|
+-----+---+----+----+---+---+---+---+----+---+---+
|    0|969|   1|   0|  0|  2|  4|  1|   1|  1|  1|
|    1|  0|1128|   1|  2|  0|  2|  1|   0|  1|  0|
|    2|  2|   3|1011|  5|  2|  0|  1|   3|  5|  0|
|    3|  1|   0|   3|990|  0|  4|  0|   6|  2|  4|
|    4|  1|   0|   1|  1|964|  0|  4|   4|  0|  7|
|    5|  2|   0|   0|  9|  1|871|  5|   0|  3|  1|
|    6|  5|   2|   2|  0|  3|  3|943|   0|  0|  0|
|    7|  1|   5|   5|  3|  0|  0|  0|1002|  1| 11|
|    8|  1|   0|   3|  7|  2|  5|  1|   2|949|  4|
|    9|  0|   2|   0|  1| 12|  6|  1|   8|  3|976|
+-----+---+----+----+---+---+---+---+----+---+---+

Duration: 54716944 ms (~911 minutes)
Precision: 0.9803
```

### 6.0 Test Data Manipulation - Error Rate: 1.74%
My next idea was to see if I could try the rotation feature creation on the reserved `test` data set then use a basic consensus algorithm to choose the most common prediction (this is similar to ensembling).

The workflow is:

- Take the reserved `test` dataset.
- Create a `+15°` AffineTransform rotated `test` dataset.
- Create a `-15°` AffineTransform rotated `test` dataset.
- Calculate predictions against all three datasets independently.
- Union the three datasets.
- Use a `groupBy` and `Window` function to select the most frequent `prediction` value. The best case is full consensus (`3`: all datasets produce same `prediction`) worst case (`1`: all three datasets have different `prediction`).
- Run standard evaluator.

Here are the changes:
```scala
import org.apache.spark.sql.expressions.Window
import org.apache.spark.sql.functions.{rowNumber, desc}

val testDF1 = assembler.transform(test).select("id",label,assembler.getOutputCol)
val testDF2 = affineTransformRotateNeg.transform(testDF1).select("id",label,affineTransformRotateNeg.getOutputCol).withColumnRenamed(affineTransformRotateNeg.getOutputCol,"features")
val testDF3 = affineTransformRotatePos.transform(testDF1).select("id",label,affineTransformRotatePos.getOutputCol).withColumnRenamed(affineTransformRotatePos.getOutputCol,"features")


val result1 = model.transform(testDF1)
val result2 = model.transform(testDF2)
val result3 = model.transform(testDF3)

val resultDF = result1.unionAll(result2).unionAll(result3)

val w = Window.partitionBy($"id").orderBy(desc("count"))

val consensusDF = {
  resultDF.groupBy("id", label, stringIndexer.getOutputCol, mlp.getPredictionCol, indexToString.getOutputCol)
  .count()
  .withColumn("rowNumber", rowNumber.over(w))
  .where($"rowNumber" <= 1)
}

val precision = evaluator.evaluate(consensusDF)

val confusionMatrix = {
  consensusDF.select(col(stringIndexer.getInputCol), col(indexToString.getOutputCol))
  .orderBy(stringIndexer.getInputCol)
  .groupBy(stringIndexer.getInputCol)
  .pivot(indexToString.getOutputCol,labels)
  .count
}
```

This results in the best score yet:

```scala
+-----+---+----+----+---+---+---+---+----+---+---+
|label|  0|   1|   2|  3|  4|  5|  6|   7|  8|  9|
+-----+---+----+----+---+---+---+---+----+---+---+
|    0|967|   0|   1|  1|  1|  4|  3|   1|  1|  1|
|    1|  0|1129|   1|  1|  0|  1|  1|   0|  2|  0|
|    2|  0|   2|1017|  3|  4|  0|  2|   4|  0|  0|
|    3|  0|   0|   5|995|  0|  2|  0|   3|  2|  3|
|    4|  1|   0|   1|  1|962|  0|  5|   5|  2|  5|
|    5|  2|   0|   0|  7|  0|874|  3|   1|  4|  1|
|    6|  3|   1|   1|  1|  4|  1|946|   0|  1|  0|
|    7|  1|   6|   5|  0|  2|  0|  1|1005|  2|  6|
|    8|  0|   0|   6|  6|  1|  4|  1|   1|950|  5|
|    9|  0|   3|   1|  3|  9|  3|  1|   4|  5|980|
+-----+---+----+----+---+---+---+---+----+---+---+

Duration: 58163956 ms (~969 minutes)
Precision: 0.9826
```
### 7.0 Sparkling Water: H2O + Spark
After reaching a bit of a dead-end with Spark's MultiLayerPerceptron Classifier I thought it would be nice to test H2O running on Spark called [Sparkling Water](http://www.h2o.ai/product/sparkling-water/) as they have achieved [extremely good performance](http://blog.h2o.ai/2015/02/deep-learning-performance/) on the MNIST dataset. **Note: I have not managed to achieve the results they have reported on their blog yet so I am not going to include the H2O error rate - this just demonstrates how to run Sparkling Water over the same dataset.**

Honestly, I don't really want this solution to win as you can see in the code below that whilst the API has been built to allow H2O to run with a Spark backend it is not integrated in the way that Spark ML is. I also think that having to install different packages produced by many different parties takes away from the clean, single ecosystem that Apache Spark provides.

Hopefully the Spark developers can reach feature and performance parity so that Spark ML can be the one framework to rule them all and we won't have to depend on external packages - but at the end of the day it is the quality of the model which counts.

```scala
import org.apache.spark.h2o._
import water.Key
import _root_.hex.deeplearning.DeepLearning
import _root_.hex.deeplearning.DeepLearningParameters
import _root_.hex.deeplearning.DeepLearningParameters.Activation
import _root_.hex.deeplearning.DeepLearningParameters.Loss
val h2oContext = H2OContext.getOrCreate(sc).start()
import h2oContext._

import org.apache.spark.ml.feature.{VectorAssembler}

val timestampStart: Long = System.currentTimeMillis

val train = sqlContext.read.load("/home/mike/data/mnist/train.parquet")
val test = sqlContext.read.load("/home/mike/data/mnist/test.parquet")

val label = "label"
val features = Array("pixel0","pixel1","pixel2","pixel3","pixel4","pixel5","pixel6","pixel7","pixel8","pixel9","pixel10","pixel11","pixel12","pixel13","pixel14","pixel15","pixel16","pixel17","pixel18","pixel19","pixel20","pixel21","pixel22","pixel23","pixel24","pixel25","pixel26","pixel27","pixel28","pixel29","pixel30","pixel31","pixel32","pixel33","pixel34","pixel35","pixel36","pixel37","pixel38","pixel39","pixel40","pixel41","pixel42","pixel43","pixel44","pixel45","pixel46","pixel47","pixel48","pixel49","pixel50","pixel51","pixel52","pixel53","pixel54","pixel55","pixel56","pixel57","pixel58","pixel59","pixel60","pixel61","pixel62","pixel63","pixel64","pixel65","pixel66","pixel67","pixel68","pixel69","pixel70","pixel71","pixel72","pixel73","pixel74","pixel75","pixel76","pixel77","pixel78","pixel79","pixel80","pixel81","pixel82","pixel83","pixel84","pixel85","pixel86","pixel87","pixel88","pixel89","pixel90","pixel91","pixel92","pixel93","pixel94","pixel95","pixel96","pixel97","pixel98","pixel99","pixel100","pixel101","pixel102","pixel103","pixel104","pixel105","pixel106","pixel107","pixel108","pixel109","pixel110","pixel111","pixel112","pixel113","pixel114","pixel115","pixel116","pixel117","pixel118","pixel119","pixel120","pixel121","pixel122","pixel123","pixel124","pixel125","pixel126","pixel127","pixel128","pixel129","pixel130","pixel131","pixel132","pixel133","pixel134","pixel135","pixel136","pixel137","pixel138","pixel139","pixel140","pixel141","pixel142","pixel143","pixel144","pixel145","pixel146","pixel147","pixel148","pixel149","pixel150","pixel151","pixel152","pixel153","pixel154","pixel155","pixel156","pixel157","pixel158","pixel159","pixel160","pixel161","pixel162","pixel163","pixel164","pixel165","pixel166","pixel167","pixel168","pixel169","pixel170","pixel171","pixel172","pixel173","pixel174","pixel175","pixel176","pixel177","pixel178","pixel179","pixel180","pixel181","pixel182","pixel183","pixel184","pixel185","pixel186","pixel187","pixel188","pixel189","pixel190","pixel191","pixel192","pixel193","pixel194","pixel195","pixel196","pixel197","pixel198","pixel199","pixel200","pixel201","pixel202","pixel203","pixel204","pixel205","pixel206","pixel207","pixel208","pixel209","pixel210","pixel211","pixel212","pixel213","pixel214","pixel215","pixel216","pixel217","pixel218","pixel219","pixel220","pixel221","pixel222","pixel223","pixel224","pixel225","pixel226","pixel227","pixel228","pixel229","pixel230","pixel231","pixel232","pixel233","pixel234","pixel235","pixel236","pixel237","pixel238","pixel239","pixel240","pixel241","pixel242","pixel243","pixel244","pixel245","pixel246","pixel247","pixel248","pixel249","pixel250","pixel251","pixel252","pixel253","pixel254","pixel255","pixel256","pixel257","pixel258","pixel259","pixel260","pixel261","pixel262","pixel263","pixel264","pixel265","pixel266","pixel267","pixel268","pixel269","pixel270","pixel271","pixel272","pixel273","pixel274","pixel275","pixel276","pixel277","pixel278","pixel279","pixel280","pixel281","pixel282","pixel283","pixel284","pixel285","pixel286","pixel287","pixel288","pixel289","pixel290","pixel291","pixel292","pixel293","pixel294","pixel295","pixel296","pixel297","pixel298","pixel299","pixel300","pixel301","pixel302","pixel303","pixel304","pixel305","pixel306","pixel307","pixel308","pixel309","pixel310","pixel311","pixel312","pixel313","pixel314","pixel315","pixel316","pixel317","pixel318","pixel319","pixel320","pixel321","pixel322","pixel323","pixel324","pixel325","pixel326","pixel327","pixel328","pixel329","pixel330","pixel331","pixel332","pixel333","pixel334","pixel335","pixel336","pixel337","pixel338","pixel339","pixel340","pixel341","pixel342","pixel343","pixel344","pixel345","pixel346","pixel347","pixel348","pixel349","pixel350","pixel351","pixel352","pixel353","pixel354","pixel355","pixel356","pixel357","pixel358","pixel359","pixel360","pixel361","pixel362","pixel363","pixel364","pixel365","pixel366","pixel367","pixel368","pixel369","pixel370","pixel371","pixel372","pixel373","pixel374","pixel375","pixel376","pixel377","pixel378","pixel379","pixel380","pixel381","pixel382","pixel383","pixel384","pixel385","pixel386","pixel387","pixel388","pixel389","pixel390","pixel391","pixel392","pixel393","pixel394","pixel395","pixel396","pixel397","pixel398","pixel399","pixel400","pixel401","pixel402","pixel403","pixel404","pixel405","pixel406","pixel407","pixel408","pixel409","pixel410","pixel411","pixel412","pixel413","pixel414","pixel415","pixel416","pixel417","pixel418","pixel419","pixel420","pixel421","pixel422","pixel423","pixel424","pixel425","pixel426","pixel427","pixel428","pixel429","pixel430","pixel431","pixel432","pixel433","pixel434","pixel435","pixel436","pixel437","pixel438","pixel439","pixel440","pixel441","pixel442","pixel443","pixel444","pixel445","pixel446","pixel447","pixel448","pixel449","pixel450","pixel451","pixel452","pixel453","pixel454","pixel455","pixel456","pixel457","pixel458","pixel459","pixel460","pixel461","pixel462","pixel463","pixel464","pixel465","pixel466","pixel467","pixel468","pixel469","pixel470","pixel471","pixel472","pixel473","pixel474","pixel475","pixel476","pixel477","pixel478","pixel479","pixel480","pixel481","pixel482","pixel483","pixel484","pixel485","pixel486","pixel487","pixel488","pixel489","pixel490","pixel491","pixel492","pixel493","pixel494","pixel495","pixel496","pixel497","pixel498","pixel499","pixel500","pixel501","pixel502","pixel503","pixel504","pixel505","pixel506","pixel507","pixel508","pixel509","pixel510","pixel511","pixel512","pixel513","pixel514","pixel515","pixel516","pixel517","pixel518","pixel519","pixel520","pixel521","pixel522","pixel523","pixel524","pixel525","pixel526","pixel527","pixel528","pixel529","pixel530","pixel531","pixel532","pixel533","pixel534","pixel535","pixel536","pixel537","pixel538","pixel539","pixel540","pixel541","pixel542","pixel543","pixel544","pixel545","pixel546","pixel547","pixel548","pixel549","pixel550","pixel551","pixel552","pixel553","pixel554","pixel555","pixel556","pixel557","pixel558","pixel559","pixel560","pixel561","pixel562","pixel563","pixel564","pixel565","pixel566","pixel567","pixel568","pixel569","pixel570","pixel571","pixel572","pixel573","pixel574","pixel575","pixel576","pixel577","pixel578","pixel579","pixel580","pixel581","pixel582","pixel583","pixel584","pixel585","pixel586","pixel587","pixel588","pixel589","pixel590","pixel591","pixel592","pixel593","pixel594","pixel595","pixel596","pixel597","pixel598","pixel599","pixel600","pixel601","pixel602","pixel603","pixel604","pixel605","pixel606","pixel607","pixel608","pixel609","pixel610","pixel611","pixel612","pixel613","pixel614","pixel615","pixel616","pixel617","pixel618","pixel619","pixel620","pixel621","pixel622","pixel623","pixel624","pixel625","pixel626","pixel627","pixel628","pixel629","pixel630","pixel631","pixel632","pixel633","pixel634","pixel635","pixel636","pixel637","pixel638","pixel639","pixel640","pixel641","pixel642","pixel643","pixel644","pixel645","pixel646","pixel647","pixel648","pixel649","pixel650","pixel651","pixel652","pixel653","pixel654","pixel655","pixel656","pixel657","pixel658","pixel659","pixel660","pixel661","pixel662","pixel663","pixel664","pixel665","pixel666","pixel667","pixel668","pixel669","pixel670","pixel671","pixel672","pixel673","pixel674","pixel675","pixel676","pixel677","pixel678","pixel679","pixel680","pixel681","pixel682","pixel683","pixel684","pixel685","pixel686","pixel687","pixel688","pixel689","pixel690","pixel691","pixel692","pixel693","pixel694","pixel695","pixel696","pixel697","pixel698","pixel699","pixel700","pixel701","pixel702","pixel703","pixel704","pixel705","pixel706","pixel707","pixel708","pixel709","pixel710","pixel711","pixel712","pixel713","pixel714","pixel715","pixel716","pixel717","pixel718","pixel719","pixel720","pixel721","pixel722","pixel723","pixel724","pixel725","pixel726","pixel727","pixel728","pixel729","pixel730","pixel731","pixel732","pixel733","pixel734","pixel735","pixel736","pixel737","pixel738","pixel739","pixel740","pixel741","pixel742","pixel743","pixel744","pixel745","pixel746","pixel747","pixel748","pixel749","pixel750","pixel751","pixel752","pixel753","pixel754","pixel755","pixel756","pixel757","pixel758","pixel759","pixel760","pixel761","pixel762","pixel763","pixel764","pixel765","pixel766","pixel767","pixel768","pixel769","pixel770","pixel771","pixel772","pixel773","pixel774","pixel775","pixel776","pixel777","pixel778","pixel779","pixel780","pixel781","pixel782","pixel783")

val assembler = { new VectorAssembler()
  .setInputCols(features)
}

val trainDF = assembler.transform(train).select(label,assembler.getOutputCol)
val testDF = assembler.transform(test).select(label,assembler.getOutputCol)

val trainH2O: H2OFrame = h2oContext.asH2OFrame(trainDF, Some("trainH2O"))
val testH2O: H2OFrame = h2oContext.asH2OFrame(testDF, Some("testH2O"))

trainH2O.replace(trainH2O.find("label"), trainH2O.vec("label").toCategoricalVec).remove()
testH2O.replace(testH2O.find("label"), testH2O.vec("label").toCategoricalVec).remove()

trainH2O.update(null)
testH2O.update(null)

// Set the Deep Learning Parameters
val dlParams = new DeepLearningParameters()
dlParams._model_id = Key.make("dlModel.hex")
dlParams._train = trainH2O
dlParams._valid = testH2O
dlParams._response_column = "label"
dlParams._loss = Loss.CrossEntropy
dlParams._activation = Activation.RectifierWithDropout
dlParams._train_samples_per_iteration = -1
dlParams._epochs = 8000
dlParams._l1 = 1e-7
dlParams._input_dropout_ratio = 0.2
dlParams._classification_stop = -1
dlParams._hidden = Array[Int](784,800)

// Create a job
val dl = new DeepLearning(dlParams)
val dlModel = dl.trainModel.get

// Compute metrics on both datasets
dlModel.score(testH2O).delete
```

### 8.0 Next Steps
So where to from here? I think I will look at further feature engineering similar to the Wikipedia blog where the authors are performing 'elastic distortions' but that will be in a follow up post.