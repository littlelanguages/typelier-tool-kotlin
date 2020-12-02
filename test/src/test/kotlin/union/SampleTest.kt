package union

import composite.ID
import composite.Location
import composite.Position
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

val p1 = Position(23, 1, 10)
val p2 = Position(25, 1, 12)
val l = Location(p1, p2)

val t1 = Reference(ID(l, "Hello"), listOf())
val t2 = Reference(ID(l, "Hello"), listOf())
val t3 = Reference(ID(l, "Seq"), listOf(t1))

class SampleTest : StringSpec({
    "Parenthesis" {
        val parenthesis = Parenthesis(l, t1)

        parenthesis.location shouldBe l
        val type = parenthesis.type as Reference
        type.name.id shouldBe "Hello"
        type.name.location shouldBe l
        type.parameters shouldBe listOf()
    }

    "Tuple" {
        val tuple = Tuple(listOf(t1, t2, t3))

        tuple.state shouldBe listOf(t1, t2, t3)
    }
})