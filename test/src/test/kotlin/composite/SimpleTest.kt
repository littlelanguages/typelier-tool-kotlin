package composite

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.littlelanguages.data.Tuple2

class SimpleTest : StringSpec({
    "SimpleA" {
        SimpleA(Tuple2("Hello", "World")).state shouldBe Tuple2("Hello", "World")
    }

    "SimpleB" {
        val v1 = Tuple2("Hello", "World")
        val v2 = Tuple2("Bye", "Love")

        val value = SimpleB(listOf(v1, v2))

        value.state.size shouldBe 2
        value.state shouldBe listOf(v1, v2)
    }
})