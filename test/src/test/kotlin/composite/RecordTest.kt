package composite

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

val p1 = Position(23, 1, 10)
val p2 = Position(25, 1, 12)
val l = Location(p1, p2)

class RecordTest : StringSpec({
    "Position" {
        p1.column shouldBe 10
        p1.line shouldBe 1
        p1.offset shouldBe 23
    }

    "Location" {
        l.start shouldBe p1
        l.end shouldBe p2
    }

    "ID" {
        val id = ID(l, "xy")

        id.id shouldBe "xy"
        id.location shouldBe l
    }

    "Set" {
        val set = SetDeclaration(
                ID(l, "xy"),
                listOf(ID(l, "True"), ID(l, "False")))

        set.name.id shouldBe "xy"
        set.elements.size shouldBe 2
        set.elements[0].id shouldBe "True"
        set.elements[1].id shouldBe "False"
    }
})