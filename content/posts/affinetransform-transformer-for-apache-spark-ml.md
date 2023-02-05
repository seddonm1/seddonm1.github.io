---
title: "AffineTransform Transformer for Apache Spark ML"
date: 2016-03-06
draft: false
tags: ["development", "spark"]
---

Whilst playing with the MNIST dataset I found I needed a way of rotating images and so I decided to build an [Affine Transform](https://en.wikipedia.org/wiki/Affine_transformation) Transformer for Apache Spark ML. I have implemented the basic Affine Transformation operations: `rotate`, `scaleX`, `scaleY`, `shearX`, `shearY`, `translateX`, `translateY`. Any pixel which exceeds the image dimensions will be discarded.I am sure the code could be improved but this is a good starting point.

To use this transformer I assume your data is `Dense` or `Sparse` `Vector` form where each pixel value is indexed. To perform the operations you need to provide the dimensions of the image with `Width` and `Height`, define the `Operation` and the `Factor`.

e.g. to `rotate` a `28`x`28` pixel image by `12.5°`:

```scala
val affineTransform = { new AffineTransform()
  .setInputCol(assembler.getOutputCol)
  .setWidth(28)
  .setHeight(28)
  .setOperation("rotate")
  .setFactor(12.5)
}
```

If you are `translating` image pixels by a fixed amount then the `Factor` will be the number of pixels. 

```scala
val affineTransform = { new AffineTransform()
  .setInputCol(assembler.getOutputCol)
  .setWidth(28)
  .setHeight(28)
  .setOperation("translateX")
  .setFactor(2)
}
```

This implementation performs rotations by performing three `shear` operations which should prevent interpolation issues and follows a more [functional programming](https://en.wikipedia.org/wiki/Functional_programming) approach.

Here is the full code:

```scala
/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.spark.ml.feature

import scala.collection.mutable.ArrayBuilder

import org.apache.spark.annotation.{Since, Experimental}
import org.apache.spark.ml.Transformer
import org.apache.spark.ml.attribute.BinaryAttribute
import org.apache.spark.ml.param._
import org.apache.spark.ml.param.shared.{HasInputCol, HasOutputCol}
import org.apache.spark.ml.util._
import org.apache.spark.sql._
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import org.apache.spark.mllib.linalg._

/**
 * :: Experimental ::
 * Affine Transform a column of image features.
 */
@Experimental
final class AffineTransform(override val uid: String)
  extends Transformer with HasInputCol with HasOutputCol with DefaultParamsWritable {

  def this() = this(Identifiable.randomUID("affineTransform"))

  /**
   * Param for the factor to pass to the manipulation function
   * Default: 1.0
   * @group param
   */
  val factor: DoubleParam =
    new DoubleParam(this, "factor", "factor to pass to the manipulation function")

  /** @group getParam */
  def getFactor: Double = $(factor)

  /** @group setParam */
  def setFactor(value: Double): this.type = set(factor, value)

  /**
   * Param for the size of the width dimension in pixels
   * @group param
   */
  val width: IntParam =
    new IntParam(this, "width", "image width in pixels")

  /** @group getParam */
  def getWidth: Int = $(width)

  /** @group setParam */
  def setWidth(value: Int): this.type = set(width, value)

  /**
   * Param for the size of the height dimension in pixels
   * @group param
   */
  val height: IntParam =
    new IntParam(this, "height", "image height in pixels")

  /** @group getParam */
  def getHeight: Int = $(height)

  /** @group setParam */
  def setHeight(value: Int): this.type = set(height, value)

  /**
   * Param for the transformation operation to perform
   * @group param
   */
  val operation: Param[String] = {
    val allowedParams = ParamValidators.inArray(Array("rotate", "scaleX", "scaleY", "shearX", "shearY", "translateX", "translateY"))
    new Param(
      this, "operation", "the transformation to perform (rotate|scaleX|scaleY|shearX|shearY|translateX|translateY)", allowedParams)
  }

  /** @group getParam */
  def getOperation: String = $(operation)

  /** @group setParam */
  def setOperation(value: String): this.type = set(operation, value)

  /** @group setParam */
  def setInputCol(value: String): this.type = set(inputCol, value)

  /** @group setParam */
  def setOutputCol(value: String): this.type = set(outputCol, value)

  class Point(index: Int) extends Serializable {
    var x: Int = index % $(width)
    var y: Int = index / $(width) + 1

    def getIndex(): Int = x + (y - 1) * $(width)

    def affineTransform(scaleX: Double, shearX: Double, translateX: Double, scaleY: Double, shearY: Double, translateY: Double) {
      x = Math.round(scaleX * x.toDouble + shearX * y.toDouble + translateX).toInt
      y = Math.round(scaleY * y.toDouble + shearY * x.toDouble + translateY).toInt
    }

    override def toString(): String = "(" + x + ", " + y + ")"
  }

  override def transform(dataset: DataFrame): DataFrame = {
    val outputSchema = transformSchema(dataset.schema)
    val schema = dataset.schema
    val inputType = schema($(inputCol)).dataType

    val t = udf { data: Vector =>
      val indices = ArrayBuilder.make[Int]
      val values = ArrayBuilder.make[Double]

      data.foreachActive { (index, value) =>
        val input: Point = new Point(index)

        val output: Point = $(operation) match {
          case "rotate" =>
            val radians: Double = Math.toRadians($(factor))
            val alpha: Double = -Math.tan(radians/2)
            val beta: Double = Math.sin(radians)

            // offsets for rotation around center
            val w: Double = $(width)/2
            val h: Double = $(height)/2

            // move pixels to allow rotation around center
            input.affineTransform(1,0,-w,1,0,-h)
            // perform three shear rotations to prevent of interpolation issues
            input.affineTransform(1,alpha,0,1,0,0)
            input.affineTransform(1,0,0,1,beta,0)
            input.affineTransform(1,alpha,0,1,0,0)
            // reset rotated pixels back to original position
            input.affineTransform(1,0,w,1,0,h)
            input
          case "scaleX" =>
            input.affineTransform($(factor),0,0,1,0,0)
            input
          case "scaleY" =>
            input.affineTransform(1,0,0,$(factor),0,0)
            input
          case "shearX" =>
            input.affineTransform(1,$(factor),0,1,0,0)
            input
          case "shearY" =>
            input.affineTransform(1,0,0,1,$(factor),0)
            input
          case "translateX" =>
            input.affineTransform(1,0,$(factor),1,0,0)
            input
          case "translateY" =>
            input.affineTransform(1,0,0,1,0,$(factor))
            input
        }

        // drop any information outside image boundaries
        if (output.x >= 0 && output.x < $(width) && output.y > 0 && output.y <= $(height)) {
          indices += output.getIndex()
          values += value
        }
      }

      Vectors.sparse(data.size, indices.result(), values.result()).compressed
    }

    val metadata = outputSchema($(outputCol)).metadata
    dataset.select(col("*"),t(col($(inputCol))).as($(outputCol), metadata))
  }

  override def transformSchema(schema: StructType): StructType = {
    validateParams()
    SchemaUtils.checkColumnType(schema, $(inputCol), new VectorUDT)
    val outputColName = $(outputCol)

    if (schema.fieldNames.contains(outputColName)) {
      throw new IllegalArgumentException(s"Output column $outputColName already exists.")
    }

    var outCol = new StructField(outputColName, new VectorUDT, true)

    StructType(schema.fields :+ outCol)
  }

  override def copy(extra: ParamMap): AffineTransform = defaultCopy(extra)
}

@Since("1.6.0")
object AffineTransform extends DefaultParamsReadable[AffineTransform] {

  @Since("1.6.0")
  override def load(path: String): AffineTransform = super.load(path)
}
```